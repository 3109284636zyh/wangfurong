const jwt = require('jsonwebtoken');

// 后台JWT认证中间件
// JWT的expiresIn已经内置了30分钟超时，jwt.verify()会自动检查
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录，请先登录后台' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // jwt.verify 会自动验证签名和过期时间
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, message: '登录已超时（30分钟），请重新登录' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ code: 401, message: 'Token无效，请重新登录' });
    } else {
      return res.status(401).json({ code: 401, message: '认证失败，请重新登录' });
    }
  }
}

module.exports = { adminAuth };
