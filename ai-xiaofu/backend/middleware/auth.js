const jwt = require('jsonwebtoken');

// 后台JWT认证（30分钟超时按文档要求）
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    // 检查是否超过30分钟
    const now = Date.now();
    const loginTime = decoded.iat * 1000;
    if (now - loginTime > 30 * 60 * 1000) {
      return res.status(401).json({ code: 401, message: '登录已超时（30分钟），请重新登录' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
  }
}

module.exports = { adminAuth };
