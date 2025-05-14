// Quicke/apps/api-worker/src/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Import route handlers
const streamRouteHandler = require('./routes/stream');
const summarizeRouteHandler = require('./routes/summarize');
const uploadRouteHandler = require('./routes/upload');
const authMiddleware = require('./middleware/auth');

// Imports for JWE self-test route
const { CompactEncrypt, jwtDecrypt } = require('jose');
const crypto = require('crypto');
const { TextEncoder } = require('util');

const app = express();
const port = process.env.PORT || 8080;

// --- CORS Configuration ---
// Normalize URLs in allowlist (remove trailing slashes)
const normalizeUrl = (url) => (url && url.endsWith('/') ? url.slice(0, -1) : url);

const allowlist = [
  normalizeUrl('http://localhost:3000'),
  normalizeUrl('https://www.quicke.in'), // process.env.VERCEL_FRONTEND_URL, process.env.NEXT_PUBLIC_URL
  normalizeUrl('https://quicke-psi.vercel.app')     
].filter(Boolean); // Filter out any undefined/null values if env vars are not set

console.log("CORS Initialized. Effective Allowlist:", allowlist);
// if (process.env.NODE_ENV === 'development' || !process.env.VERCEL_FRONTEND_URL) { 
//     console.log("Raw VERCEL_FRONTEND_URL from env:", process.env.VERCEL_FRONTEND_URL);
//     console.log("Raw NEXT_PUBLIC_URL from env:", process.env.NEXT_PUBLIC_URL);
// }

const corsOptions = {
  origin: function (origin, callback) {
    // `origin` is the value of the Origin header from the request.
    // It can be undefined for same-origin requests or server-to-server/tooling requests.

    // Log every CORS origin check attempt
    console.log(`CORS Check: Request Origin header is '${origin}'.`);

    // Allow requests with no origin (like mobile apps, server-to-server, curl, Postman etc.)
    if (!origin) {
      console.log("CORS Check: No Origin header present, ALLOWING request.");
      return callback(null, true);
    }

    const normalizedOrigin = normalizeUrl(origin);
    if (allowlist.includes(normalizedOrigin)) {
      console.log(`CORS Check: Normalized Origin '${normalizedOrigin}' is in allowlist. ALLOWING request.`);
      callback(null, true);
    } else {
      console.warn(`CORS Check: Normalized Origin '${normalizedOrigin}' is NOT in allowlist. BLOCKING request. Current allowlist: [${allowlist.join(', ')}]`);
      // For a disallowed origin, callback with `false` for the second argument.
      // You can optionally pass an error as the first argument if it's truly an error condition.
      // For a simple "not allowed", `null, false` is standard.
      callback(new Error(`Origin '${normalizedOrigin}' not allowed by CORS.`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'], // Explicitly define allowed methods
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'], // Include common headers and 'Authorization' for JWT
  credentials: true,        // IMPORTANT: to allow cookies (like your session token) to be sent
  // preflightContinue: false, // Let the cors middleware handle the OPTIONS response directly
  // optionsSuccessStatus: 204 // Standard for successful OPTIONS preflight (some legacy browsers choke on 204, but 200 is also fine)
};

// Apply CORS middleware globally
app.use(cors(corsOptions));
// --- End CORS Configuration ---

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// --- Routes ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API Worker is healthy' });
});

// JWE Self-Test Route (leave as is)
app.get('/api/test-jwe', async (req, res) => {
  // ... (your existing test-jwe code)
  console.log('--- JWE SELF-TEST ROUTE INVOKED ---');
  const secretStringForTest = process.env.NEXTAUTH_SECRET;

  if (!secretStringForTest) {
    console.error("JWE TEST: NEXTAUTH_SECRET environment variable is NOT SET for the test route!");
    return res.status(500).json({ success: false, error: "Test setup error: NEXTAUTH_SECRET is missing in worker environment" });
  }

  let testCEK_Buffer;
  try {
    const hashedSecret = crypto.createHash('sha256').update(secretStringForTest, 'utf8').digest();
    testCEK_Buffer = hashedSecret.slice(0, 32);
  } catch (e) {
    console.error("JWE TEST: Error deriving CEK for test:", e);
    return res.status(500).json({ success: false, error: "Test setup error: CEK derivation failed", details: e.message });
  }

  let jweString;
  try {
    const originalPayload = { message: "Hello from JWE self-test!", sub: "test-user-jwe-123", iat: Math.floor(Date.now() / 1000) };
    const plaintext = new TextEncoder().encode(JSON.stringify(originalPayload));

    jweString = await new CompactEncrypt(plaintext)
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .encrypt(testCEK_Buffer);

    const { payload: decryptedPayloadObject } = await jwtDecrypt(jweString, testCEK_Buffer);

    if (decryptedPayloadObject.sub === originalPayload.sub && decryptedPayloadObject.message === originalPayload.message) {
      console.log("JWE TEST Route: SUCCESS - Self-encryption and decryption match.");
      res.status(200).json({ success: true, message: "JWE self-test successful", decrypted: decryptedPayloadObject });
    } else {
      console.error("JWE TEST Route: FAILURE - Decrypted payload does not match original.");
      throw new Error("Decrypted payload mismatch during self-test.");
    }
  } catch (err) {
    console.error("JWE TEST Route: Error during self-encrypt/decrypt test process.", { name: err.name, message: err.message, code: err.code });
    res.status(500).json({
        success: false,
        error: "JWE self-test failed",
        details: { name: err.name, message: err.message, code: err.code }
    });
  }
});

// Apply JWT validation middleware to other protected routes
app.use('/api/stream', authMiddleware);
app.use('/api/summarize', authMiddleware);
app.use('/api/upload', authMiddleware);

// Mount route handlers
app.use('/api/stream', streamRouteHandler);
app.use('/api/summarize', summarizeRouteHandler);
app.use('/api/upload', uploadRouteHandler);
// --- End Routes ---

// --- Global Error Handler ---
// This will catch errors passed via next(err) or unhandled errors in synchronous code.
// Errors thrown from the CORS origin function will also land here if not handled by `cors` itself.
app.use((err, req, res, next) => {
  console.error("SERVER UNHANDLED ERROR:", err.message);
  console.error("Stack:", err.stack || "No stack available");

  // If the error is a CORS error from our custom origin function
  if (err.message && err.message.includes("not allowed by CORS")) {
    return res.status(403).json({ // 403 Forbidden is appropriate for CORS rejections
      error: 'CORS Error',
      message: err.message,
    });
  }

  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred on the server.',
  });
});
// --- End Error Handler ---

app.listen(port, () => {
  console.log(`🚀 Quicke API Worker listening on port ${port}`);
  const secretLoaded = !!process.env.NEXTAUTH_SECRET;
  console.log(`🔑 NEXTAUTH_SECRET loaded in server.js at startup: ${secretLoaded}`);
  if (!secretLoaded) {
      console.error("CRITICAL: NEXTAUTH_SECRET was NOT loaded at startup in server.js! Auth will fail.");
  }
  console.log(`🔑 DATABASE_URL loaded in server.js at startup: "${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}"`); // Avoid logging the full URL
});