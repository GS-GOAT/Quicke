// Quicke/apps/api-worker/src/middleware/auth.js
const { jwtDecrypt } = require('jose');
const crypto = require('crypto');

const NEXTAUTH_SECRET_STRING = process.env.NEXTAUTH_SECRET;
let JWE_CEK_SECRET = null;

if (!NEXTAUTH_SECRET_STRING) {
  console.error("FATAL ERROR (api-worker/auth.js): NEXTAUTH_SECRET environment variable is not set!");
} else {
  const hashedSecret = crypto.createHash('sha256').update(NEXTAUTH_SECRET_STRING, 'utf8').digest();
  JWE_CEK_SECRET = hashedSecret.slice(0, 32);
}

module.exports = async (req, res, next) => {
  const isGuestRouteStream = req.originalUrl.startsWith('/api/stream');
  const isGuestRouteSummarize = req.originalUrl.startsWith('/api/summarize');

  if ((isGuestRouteStream || isGuestRouteSummarize) && req.query.isGuest === 'true') {
    return next();
  }

  if (!JWE_CEK_SECRET) {
      console.error("Auth error: JWE_CEK_SECRET not derived.");
      return res.status(500).json({ error: 'Internal Server Authentication Configuration Error' });
  }

  let tokenString = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    tokenString = authHeader.split(' ')[1];
    if (tokenString === "null" || tokenString === "undefined") tokenString = null;
  }

  if (!tokenString && req.cookies) {
    if (req.cookies['next-auth.session-token']) {
      tokenString = req.cookies['next-auth.session-token'];
      if (tokenString === "null" || tokenString === "undefined") tokenString = null;
    } else if (req.cookies['__Secure-next-auth.session-token']) {
      tokenString = req.cookies['__Secure-next-auth.session-token'];
      if (tokenString === "null" || tokenString === "undefined") tokenString = null;
    }
  }

  if (!tokenString) {
    return res.status(401).json({ error: 'Unauthorized: No token provided to worker' });
  }

  let jweProtectedHeader;
  try {
      const jweHeaderParts = tokenString.split('.');
      if (jweHeaderParts.length === 5) {
          jweProtectedHeader = JSON.parse(Buffer.from(jweHeaderParts[0], 'base64url').toString('utf8'));
      } else {
          return res.status(401).json({ error: 'Unauthorized: Malformed token structure (parts)' });
      }
  } catch (e) {
      return res.status(401).json({ error: 'Unauthorized: Malformed token header (parsing)' });
  }

  if (!jweProtectedHeader || jweProtectedHeader.alg !== 'dir' || jweProtectedHeader.enc !== 'A256GCM') {
      return res.status(401).json({ error: 'Unauthorized: Token algorithm mismatch' });
  }

  try {
    const { payload } = await jwtDecrypt(tokenString, JWE_CEK_SECRET);
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload (no sub)' });
    }
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
  }
};