// Quicke/apps/api-worker/src/server.js
require('dotenv').config(); // Load .env file from the root of api-worker if present

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
const { TextEncoder, TextDecoder } = require('util');

const app = express();
const port = process.env.PORT || 8080;

// --- CORS Configuration ---
const allowlist = [
  'http://localhost:3000', // For local vercel dev
  process.env.VERCEL_FRONTEND_URL,
  process.env.NEXT_PUBLIC_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowlist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS: Request from origin '${origin}' blocked.`);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
// --- End CORS Configuration ---

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// --- Routes ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API Worker is healthy' });
});

// +++ JWE Self-Test Route (Corrected to handle payload as object) +++
app.get('/api/test-jwe', async (req, res) => {
  console.log('--- JWE SELF-TEST ROUTE INVOKED ---');
  const secretStringForTest = process.env.NEXTAUTH_SECRET;

  if (!secretStringForTest) {
    console.error("JWE TEST: NEXTAUTH_SECRET environment variable is NOT SET for the test route!");
    return res.status(500).json({ success: false, error: "Test setup error: NEXTAUTH_SECRET is missing in worker environment" });
  }
  // console.log("JWE TEST Route: Raw NEXTAUTH_SECRET_STRING being used for test:", `"${secretStringForTest}"`);

  let testCEK_Buffer;
  try {
    const hashedSecret = crypto.createHash('sha256').update(secretStringForTest, 'utf8').digest();
    testCEK_Buffer = hashedSecret.slice(0, 32);
    // console.log("JWE TEST Route: Derived CEK for test (Buffer, first 5 hex):", testCEK_Buffer.slice(0,5).toString('hex'));
    // console.log("JWE TEST Route: Derived CEK length (bytes):", testCEK_Buffer.length);
  } catch (e) {
    console.error("JWE TEST: Error deriving CEK for test:", e);
    return res.status(500).json({ success: false, error: "Test setup error: CEK derivation failed", details: e.message });
  }

  let jweString;

  try {
    const originalPayload = { message: "Hello from JWE self-test!", sub: "test-user-jwe-123", iat: Math.floor(Date.now() / 1000) };
    // console.log("JWE TEST Route: Original Payload for encryption:", originalPayload);
    const plaintext = new TextEncoder().encode(JSON.stringify(originalPayload));

    jweString = await new CompactEncrypt(plaintext)
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .encrypt(testCEK_Buffer);

    if (typeof jweString !== 'string' || jweString.split('.').length !== 5) {
        throw new Error(`Encryption did not produce a valid JWE string. Received (type ${typeof jweString}): ${jweString}`);
    }
    // console.log("JWE TEST Route: Encrypted JWE string (snippet):", jweString.substring(0,50) + "...");

    const { payload: decryptedPayloadObject, protectedHeader: decryptedProtectedHeader } = await jwtDecrypt(jweString, testCEK_Buffer);
    // console.log("JWE TEST Route: Decryption successful. Decrypted Protected Header:", decryptedProtectedHeader);
    // console.log("JWE TEST Route: Decrypted Payload Object directly from jose.jwtDecrypt:", decryptedPayloadObject);

    if (!decryptedPayloadObject || typeof decryptedPayloadObject !== 'object') {
        throw new Error("Decrypted payload from jose is not an object as expected.");
    }

    if (decryptedPayloadObject.sub === originalPayload.sub && decryptedPayloadObject.message === originalPayload.message) {
      console.log("JWE TEST Route: SUCCESS - Self-encryption and decryption match.");
      res.status(200).json({ success: true, message: "JWE self-test successful", decrypted: decryptedPayloadObject });
    } else {
      console.error("JWE TEST Route: FAILURE - Decrypted payload does not match original.");
      console.error("Original:", originalPayload);
      console.error("Decrypted:", decryptedPayloadObject);
      throw new Error("Decrypted payload mismatch during self-test.");
    }
  } catch (err) {
    console.error("JWE TEST Route: Error during self-encrypt/decrypt test process.");
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
    if(err.code) console.error("Error Code:", err.code);
    // console.error("Error Stack:", err.stack);
    // console.error("Value of jweString at point of error:", jweString === undefined ? "undefined" : (typeof jweString === 'string' ? jweString.substring(0,50)+"..." : JSON.stringify(jweString)));
    res.status(500).json({
        success: false,
        error: "JWE self-test failed",
        details: { name: err.name, message: err.message, code: err.code }
    });
  }
});
// +++ END JWE TEST ROUTE +++

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
app.use((err, req, res, next) => {
  console.error("SERVER UNHANDLED ERROR:", err.message);
  console.error("Stack:", err.stack || "No stack available");
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
  if(secretLoaded) {
      // console.log(`   (Initial NEXTAUTH_SECRET value first 5 chars: "${process.env.NEXTAUTH_SECRET.substring(0,5)}...")`);
  } else {
      console.error("CRITICAL: NEXTAUTH_SECRET was NOT loaded at startup in server.js! Auth will fail.");
  }
  console.log(`🔑 DATABASE_URL loaded in server.js at startup: "${process.env.DATABASE_URL}"`);
});