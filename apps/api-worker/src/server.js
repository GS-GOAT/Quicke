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

const normalizeUrl = (url) => (url && url.endsWith('/') ? url.slice(0, -1) : url);

const allowlist = [
  normalizeUrl('http://localhost:3000'),
  normalizeUrl('https://www.quicke.in'), 
  normalizeUrl('https://quicke-psi.vercel.app')     
].filter(Boolean); 

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    const normalizedOrigin = normalizeUrl(origin);
    if (allowlist.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origin '${normalizedOrigin}' not allowed.`);
      callback(new Error(`Origin '${normalizedOrigin}' not allowed by CORS.`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// --- Routes ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API Worker is healthy' });
});

// JWE Self-Test Route (leave as is)
app.get('/api/test-jwe', async (req, res) => {
  const secretStringForTest = process.env.NEXTAUTH_SECRET;
  if (!secretStringForTest) {
    console.error("JWE TEST: NEXTAUTH_SECRET is NOT SET.");
    return res.status(500).json({ success: false, error: "Test setup error: NEXTAUTH_SECRET is missing" });
  }
  let testCEK_Buffer;
  try {
    const hashedSecret = crypto.createHash('sha256').update(secretStringForTest, 'utf8').digest();
    testCEK_Buffer = hashedSecret.slice(0, 32);
  } catch (e) {
    console.error("JWE TEST: Error deriving CEK:", e);
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
      res.status(200).json({ success: true, message: "JWE self-test successful", decrypted: decryptedPayloadObject });
    } else {
      console.error("JWE TEST: Decrypted payload mismatch.");
      throw new Error("Decrypted payload mismatch during self-test.");
    }
  } catch (err) {
    console.error("JWE TEST: Error during self-encrypt/decrypt.", { name: err.name, message: err.message, code: err.code });
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

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err.message);
  if (err.message && err.message.includes("not allowed by CORS")) {
    return res.status(403).json({
      error: 'CORS Error',
      message: err.message,
    });
  }
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred on the server.',
  });
});

app.listen(port, () => {
  console.log(`API Worker listening on port ${port}`);
  const secretLoaded = !!process.env.NEXTAUTH_SECRET;
  if (!secretLoaded) {
      console.error("CRITICAL: NEXTAUTH_SECRET was NOT loaded at startup!");
  }
});