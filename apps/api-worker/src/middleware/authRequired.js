const { extractToken, decryptJWE, getJweCekSecret } = require('@quicke/utils');

const cekSecret = getJweCekSecret(process.env.NEXTAUTH_SECRET);

module.exports = async function authRequired(req, res, next) {
  let tokenString = extractToken(req);
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