// Quicke/apps/web/pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcrypt";
const { PrismaClient } = require('../../../prisma/generated-client');
const prisma = new PrismaClient();

const jose = require('jose');
const crypto = require('crypto');
const { TextEncoder } = require('util'); // TextDecoder is not needed for encode

const effectiveNextAuthSecret = process.env.MY_APP_NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET;
let derivedJWEKeyForNextAuth; // key used for JWE operations

if (!effectiveNextAuthSecret) {
  console.error("CRITICAL ERROR in [...nextauth].js: No NextAuth secret is defined. Check MY_APP_NEXTAUTH_SECRET and NEXTAUTH_SECRET env vars.");
} else {
  console.log(`[...nextauth].js using secret string for key derivation starting with: ${effectiveNextAuthSecret.substring(0,5)}... (from ${process.env.MY_APP_NEXTAUTH_SECRET ? 'MY_APP_NEXTAUTH_SECRET' : 'NEXTAUTH_SECRET'})`);
  // Derive the key exactly as in the api-worker
  const hash = crypto.createHash('sha256').update(effectiveNextAuthSecret, 'utf8').digest();
  derivedJWEKeyForNextAuth = hash.slice(0, 32); // 32 bytes for A256GCM
  console.log(`[...nextauth].js derived JWE key (first 5 hex): ${derivedJWEKeyForNextAuth.slice(0,5).toString('hex')}`);
}

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });
        if (!user || !user.password) {
            // console.log("Authorize: User not found or password not set for email:", credentials.email);
            return null;
        }
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordValid) {
            // console.log("Authorize: Invalid password for email:", credentials.email);
            return null;
        }
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    // The secret option in jwt is used by NextAuth's default encode/decode
    // if you don't provide your own. We provide the top-level secret for other parts of NextAuth.
    // Our custom encode/decode will use derivedJWEKeyForNextAuth.
    secret: effectiveNextAuthSecret, // Still good to provide the base string secret here

    async encode({ token, secret, maxAge }) {
      // 'secret' arg here is effectiveNextAuthSecret
      // 'token' arg is the payload NextAuth wants to put into the JWT (e.g., { id, name, email, iat, exp, ...})
      if (!derivedJWEKeyForNextAuth) {
        console.error("[NextAuth Encode Error] derivedJWEKeyForNextAuth is not initialized!");
        throw new Error("NextAuth JWT encode: Encryption key not derived.");
      }
      // console.log("[NextAuth Encode] Encoding token with derived key (first 5 hex):", derivedJWEKeyForNextAuth.slice(0,5).toString('hex'));
      // console.log("[NextAuth Encode] Payload to encrypt:", token);

      const now = Math.floor(Date.now() / 1000);
      const claims = {
        ...token, // Includes 'id', 'name', 'email' etc. from the jwt callback
        iat: token.iat || now,
        exp: token.exp || (now + (maxAge || 30 * 24 * 60 * 60)),
      };
      // console.log("[NextAuth Encode] Claims being encrypted:", claims);

      return await new jose.CompactEncrypt(new TextEncoder().encode(JSON.stringify(claims)))
        .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' }) // Explicitly set alg and enc
        .encrypt(derivedJWEKeyForNextAuth);
    },
    async decode({ token, secret }) {
      // 'secret' arg here is effectiveNextAuthSecret
      // 'token' arg is the JWE string from the cookie
      if (!derivedJWEKeyForNextAuth) {
        console.error("[NextAuth Decode Error] derivedJWEKeyForNextAuth is not initialized!");
        throw new Error("NextAuth JWT decode: Decryption key not derived.");
      }
      if (!token) {
        // console.log("[NextAuth Decode] No token to decode.");
        return null;
      }
      try {
        // console.log("[NextAuth Decode] Decoding token with derived key (first 5 hex):", derivedJWEKeyForNextAuth.slice(0,5).toString('hex'));
        // console.log("[NextAuth Decode] Token to decrypt (snippet):", token.substring(0,30)+"...");
        const { payload } = await jose.jwtDecrypt(token, derivedJWEKeyForNextAuth);
        // console.log("[NextAuth Decode] Successfully decoded payload:", payload);
        return payload; // payload is already the JS object
      } catch (error) {
        console.error("[NextAuth Decode Error] JWE decryption failed:", error.name, error.message, error.code);
        // console.error("[NextAuth Decode Error] Token that failed (snippet):", token.substring(0,30)+"...");
        return null;
      }
    }
  },
  // +++ END JWT BLOCK +++
  callbacks: {
    async signIn({ user, account, profile }) {
      // --- Google Account Linking Logic ---
      if (account?.provider === "google" && profile?.email) {
        // Check if a user already exists with this email but NOT linked to this Google account
        const existingUserByEmail = await prisma.user.findUnique({
          where: { email: profile.email },
          include: { accounts: true },
        });
        if (existingUserByEmail) {
          const isGoogleLinked = existingUserByEmail.accounts.some(
            (acc) => acc.provider === "google" && acc.providerAccountId === account.providerAccountId
          );
          if (!isGoogleLinked) {
            // Attempt to link Google account to existing user (if not already linked)
            try {
              await prisma.account.create({
                data: {
                  userId: existingUserByEmail.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                  session_state: account.session_state,
                },
              });
              // After linking, let NextAuth continue. If user isNewUser, onboarding logic below will run.
            } catch (linkError) {
              console.error("Error auto-linking Google account:", linkError);
              // If linking fails, let it proceed to the default error.
              return "/auth/signin?error=OAuthLinkError";
            }
          }
        }
        // If this is a new user (first time Google sign-in), set onboarding flag
        if (user && user.isNewUser) {
          user.redirectToOnboarding = true;
        }
      }
      // --- End Google Account Linking Logic ---
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        if (user.redirectToOnboarding) {
          token.redirectToOnboarding = true;
        }
      }
      if (account?.provider === "google") {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.accessToken = token.accessToken;
        if (token.redirectToOnboarding) {
          session.redirectToOnboarding = true;
          delete token.redirectToOnboarding;
        }
      } else if (token) {
        session.user = { id: token.id };
        session.user.accessToken = token.accessToken;
        if (token.redirectToOnboarding) {
          session.redirectToOnboarding = true;
          delete token.redirectToOnboarding;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: effectiveNextAuthSecret, // Top-level secret for other NextAuth functions
  cookies: { /* ... your existing cookie config ... */ },
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);