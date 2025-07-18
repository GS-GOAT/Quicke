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
const { TextEncoder } = require('util'); 

const effectiveNextAuthSecret = process.env.MY_APP_NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET;
let derivedJWEKeyForNextAuth; // key used for JWE operations

if (!effectiveNextAuthSecret) {
  console.error("CRITICAL ERROR in [...nextauth].js: No NextAuth secret is defined. Check MY_APP_NEXTAUTH_SECRET and NEXTAUTH_SECRET env vars.");
} else {
  console.log("NextAuth initialized.");
  const hash = crypto.createHash('sha256').update(effectiveNextAuthSecret, 'utf8').digest();
  derivedJWEKeyForNextAuth = hash.slice(0, 32);
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
            return null;
        }
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordValid) {
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
    secret: effectiveNextAuthSecret, 

    async encode({ token, secret, maxAge }) {
      if (!derivedJWEKeyForNextAuth) {
        console.error("[NextAuth Encode Error] derivedJWEKeyForNextAuth is not initialized!");
        throw new Error("NextAuth JWT encode: Encryption key not derived.");
      }
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        ...token,
        iat: token.iat || now,
        exp: token.exp || (now + (maxAge || 30 * 24 * 60 * 60)),
      };
      return await new jose.CompactEncrypt(new TextEncoder().encode(JSON.stringify(claims)))
        .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
        .encrypt(derivedJWEKeyForNextAuth);
    },
    async decode({ token, secret }) {
      if (!derivedJWEKeyForNextAuth) {
        console.error("[NextAuth Decode Error] derivedJWEKeyForNextAuth is not initialized!");
        throw new Error("NextAuth JWT decode: Decryption key not derived.");
      }
      if (!token) {
        return null;
      }
      try {
        const { payload } = await jose.jwtDecrypt(token, derivedJWEKeyForNextAuth);
        return payload;
      } catch (error) {
        console.error("[NextAuth Decode Error] JWE decryption failed:", error.name, error.message, error.code);
        return null;
      }
    }
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const existingUserByEmail = await prisma.user.findUnique({
          where: { email: profile.email },
          include: { accounts: true },
        });
        if (existingUserByEmail) {
          const isGoogleLinked = existingUserByEmail.accounts.some(
            (acc) => acc.provider === "google" && acc.providerAccountId === account.providerAccountId
          );
          if (!isGoogleLinked) {
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
            } catch (linkError) {
              console.error("Error auto-linking Google account:", linkError);
              return "/auth/signin?error=OAuthLinkError";
            }
          }
        }
        if (user && user.isNewUser) {
          user.redirectToOnboarding = true;
        }
      }
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
  secret: effectiveNextAuthSecret, 
  cookies: {  },
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);