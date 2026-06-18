const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // Accept token from Authorization header OR ?token= query param (for img src)
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ error: 'Token no provisto' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload contiene userId y businessId -> esto define el tenant
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = authMiddleware;
