// Quicke/apps/api-worker/src/middleware/auth.js
const { jwtDecrypt } = require('jose');
const crypto = require('crypto');

const NEXTAUTH_SECRET_STRING = process.env.NEXTAUTH_SECRET;
let JWE_CEK_SECRET = null;

if (!NEXTAUTH_SECRET_STRING) {
  console.error("FATAL ERROR (api-worker/auth.js): NEXTAUTH_SECRET environment variable is not set!");
  // process.exit(1); // Consider if all routes truly need auth or if some can proceed without req.user
} else {
  // console.log("Auth Middleware (api-worker): Raw NEXTAUTH_SECRET_STRING from env:", `"${NEXTAUTH_SECRET_STRING}"`);
  const hashedSecret = crypto.createHash('sha256').update(NEXTAUTH_SECRET_STRING, 'utf8').digest();
  JWE_CEK_SECRET = hashedSecret.slice(0, 32);
  console.log("Auth Middleware (api-worker): Derived JWE CEK for decryption (first 5 hex bytes):", JWE_CEK_SECRET.slice(0, 5).toString('hex'));
}

module.exports = async (req, res, next) => {
  // Check for guest flag specifically for /api/stream (or any other guest-allowed route)
  if (req.originalUrl.startsWith('/api/stream') && req.query.isGuest === 'true') {
    console.log("API WORKER AUTH: Guest request to /api/stream. Bypassing token validation.");
    // req.user will remain undefined for guests. stream.js will handle this.
    return next();
  }

  // Existing authentication logic for non-guest users
  if (!JWE_CEK_SECRET) {
      console.error("API WORKER AUTH: CRITICAL - JWE_CEK_SECRET not derived. NEXTAUTH_SECRET issue at module load.");
      return res.status(500).json({ error: 'Internal Server Authentication Configuration Error' });
  }

  console.log('------------------------------------');
  console.log(`API WORKER AUTH: Path: ${req.method} ${req.originalUrl}`);
  // console.log('API WORKER AUTH: All Parsed Cookies:', JSON.stringify(req.cookies, null, 2)); // Can be too verbose

  let tokenString = null;
  let tokenSource = "none";

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    tokenString = authHeader.split(' ')[1];
    tokenSource = (tokenString && tokenString !== "null" && tokenString !== "undefined") ? "Authorization Header" : "none_invalid_bearer";
    if (tokenString === "null" || tokenString === "undefined") tokenString = null;
  }

  if (!tokenString && req.cookies) {
    if (req.cookies['next-auth.session-token']) {
      tokenString = req.cookies['next-auth.session-token'];
      tokenSource = (tokenString && tokenString !== "null" && tokenString !== "undefined") ? "next-auth.session-token cookie" : "none_invalid_dev_cookie";
      if (tokenString === "null" || tokenString === "undefined") tokenString = null;

    } else if (req.cookies['__Secure-next-auth.session-token']) {
      tokenString = req.cookies['__Secure-next-auth.session-token'];
      tokenSource = (tokenString && tokenString !== "null" && tokenString !== "undefined") ? "__Secure-next-auth.session-token cookie" : "none_invalid_prod_cookie";
      if (tokenString === "null" || tokenString === "undefined") tokenString = null;
    }
  }

  if (!tokenString) {
    console.warn(`API WORKER AUTH: No valid token for non-guest user for ${req.originalUrl}.`);
    return res.status(401).json({ error: 'Unauthorized: No token provided to worker' });
  }

  // console.log(`API WORKER AUTH: Token found via ${tokenSource}.`);
  // Log the full token ONLY IF it's short or if deep debugging is needed. For snippets:
  // console.log(`API WORKER AUTH: Token string snippet: ${tokenString.substring(0, 30)}...${tokenString.substring(tokenString.length - 10)}`);
  // console.log(`API WORKER AUTH: Full token string: ${tokenString}`); // UNCOMMENT FOR DEEP DEBUG - POTENTIALLY SENSITIVE

  let jweProtectedHeader;
  try {
      const jweHeaderParts = tokenString.split('.');
      if (jweHeaderParts.length === 5) { // Compact JWE has 5 parts
          jweProtectedHeader = JSON.parse(Buffer.from(jweHeaderParts[0], 'base64url').toString('utf8'));
          // console.log("API WORKER AUTH: Parsed JWE Protected Header from incoming token:", jweProtectedHeader);
      } else {
          console.error("API WORKER AUTH: Malformed token structure (parts). Parts found:", jweHeaderParts.length);
          return res.status(401).json({ error: 'Unauthorized: Malformed token structure (parts)' });
      }
  } catch (e) {
      console.warn("API WORKER AUTH: Could not parse JWE header. Error:", e.message);
      return res.status(401).json({ error: 'Unauthorized: Malformed token header (parsing)' });
  }

  // Double check header values before attempting decryption
  if (!jweProtectedHeader || jweProtectedHeader.alg !== 'dir' || jweProtectedHeader.enc !== 'A256GCM') {
      console.error("API WORKER AUTH: Token JWE header mismatch. Header:", jweProtectedHeader);
      return res.status(401).json({ error: 'Unauthorized: Token algorithm mismatch' });
  }

  try {
    console.log("API WORKER AUTH: Attempting JWE decryption...");
    const { payload } = await jwtDecrypt(tokenString, JWE_CEK_SECRET);

    if (!payload || !payload.sub) {
      console.error("API WORKER AUTH: JWE Decrypted but 'sub' (user ID) is missing. Payload:", payload);
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload (no sub)' });
    }

    req.user = { id: payload.sub }; // Set req.user for authenticated users
    console.log("API WORKER AUTH: Token DECRYPTED for user:", req.user.id);
    next();
  } catch (err) {
    console.error("API WORKER AUTH: JWE Decryption FAILED. Path:", req.originalUrl, "Error:", err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token (worker processing)' });
  }
};