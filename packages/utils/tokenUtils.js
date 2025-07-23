const { jwtDecrypt } = require('jose');
const crypto = require('crypto');

function getJweCekSecret(secretString) {
  if (!secretString) throw new Error('NEXTAUTH_SECRET is not set');
  const hashedSecret = crypto.createHash('sha256').update(secretString, 'utf8').digest();
  return hashedSecret.slice(0, 32);
}

function extractToken(req) {
  let tokenString = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    tokenString = authHeader.split(' ')[1];
    if (tokenString === 'null' || tokenString === 'undefined') tokenString = null;
  }
  if (!tokenString && req.cookies) {
    if (req.cookies['next-auth.session-token']) {
      tokenString = req.cookies['next-auth.session-token'];
      if (tokenString === 'null' || tokenString === 'undefined') tokenString = null;
    } else if (req.cookies['__Secure-next-auth.session-token']) {
      tokenString = req.cookies['__Secure-next-auth.session-token'];
      if (tokenString === 'null' || tokenString === 'undefined') tokenString = null;
    }
  }
  return tokenString;
}

async function decryptJWE(tokenString, cekSecret) {
  let jweProtectedHeader;
  try {
    const jweHeaderParts = tokenString.split('.');
    if (jweHeaderParts.length === 5) {
      jweProtectedHeader = JSON.parse(Buffer.from(jweHeaderParts[0], 'base64url').toString('utf8'));
    } else {
      throw new Error('Malformed token structure (parts)');
    }
  } catch (e) {
    throw new Error('Malformed token header (parsing)');
  }
  if (!jweProtectedHeader || jweProtectedHeader.alg !== 'dir' || jweProtectedHeader.enc !== 'A256GCM') {
    throw new Error('Token algorithm mismatch');
  }
  const { payload } = await jwtDecrypt(tokenString, cekSecret);
  return payload;
}

module.exports = {
  getJweCekSecret,
  extractToken,
  decryptJWE,
}; 