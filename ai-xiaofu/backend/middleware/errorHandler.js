/**
 * 统一错误处理中间件
 * 捕获所有路由中未处理的错误，返回标准格式的错误响应
 */

// 错误代码定义
const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// 自定义错误类
class AppError extends Error {
  constructor(message, code = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

// 错误处理中间件
function errorHandler(err, req, res, next) {
  // 默认错误信息
  let statusCode = err.code || 500;
  let message = err.message || '服务器内部错误';
  let details = err.details || null;

  // 开发环境显示详细错误，生产环境隐藏敏感信息
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // 数据库错误
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 400;
    message = '数据已存在，请勿重复添加';
  } else if (err.code && err.code.startsWith('ER_')) {
    statusCode = 500;
    message = isDevelopment ? `数据库错误: ${err.message}` : '数据库操作失败';
  }

  // JWT错误
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = '登录已过期，请重新登录';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token无效';
  }

  // 验证错误（joi）
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = '输入验证失败';
    details = err.details || err.message;
  }

  // 记录错误日志
  if (statusCode >= 500) {
    console.error('服务器错误:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
  }

  // 返回错误响应
  const response = {
    code: statusCode,
    message: message
  };

  // 开发环境添加额外调试信息
  if (isDevelopment && statusCode >= 500) {
    response.stack = err.stack;
    response.details = details;
  }

  res.status(statusCode).json(response);
}

// 404处理中间件
function notFoundHandler(req, res) {
  if (req.originalUrl.startsWith('/api')) {
    res.status(404).json({
      code: 404,
      message: `API接口不存在: ${req.method} ${req.originalUrl}`
    });
  } else {
    res.status(404).send('页面未找到');
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  AppError,
  ERROR_CODES
};
