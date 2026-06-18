/**
 * 简易内存限流中间件
 * 适合当前单进程部署；多实例部署时可替换为Redis限流。
 */

const stores = new Map();

function getClientKey(req, scope) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return `${scope}:token:${authHeader.slice(7, 23)}`;
  }
  const remoteAddress = req.connection && req.connection.remoteAddress ? req.connection.remoteAddress : 'unknown';
  return `${scope}:ip:${req.ip || remoteAddress}`;
}

function createRateLimiter(options) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 60;
  const scope = options.scope || 'default';
  const message = options.message || '请求过于频繁，请稍后再试';

  if (!stores.has(scope)) stores.set(scope, new Map());
  const store = stores.get(scope);

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = getClientKey(req, scope);
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      return next();
    }

    if (current.count >= max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({ code: 429, message, retry_after_seconds: retryAfter });
    }

    current.count += 1;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(max - current.count));
    next();
  };
}

// 定期清理过期桶，避免长期运行内存增长
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, value] of store.entries()) {
      if (value.resetAt <= now) store.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

module.exports = { createRateLimiter };
