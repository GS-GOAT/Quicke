const { extractToken, decryptJWE, getJweCekSecret } = require('@quicke/utils');

const cekSecret = getJweCekSecret(process.env.NEXTAUTH_SECRET);

module.exports = async function authOptional(req, res, next) {
  const tokenString = extractToken(req);
  if (!tokenString && req.query.isGuest === 'true') {
    req.user = { isGuest: true };
    return next();
  }
  if (!tokenString) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  try {
    const payload = await decryptJWE(tokenString, cekSecret);
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }
    req.user = { id: payload.sub };
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized: ' + e.message });
  }
}; 