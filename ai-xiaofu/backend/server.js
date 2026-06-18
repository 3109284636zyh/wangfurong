require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { createRateLimiter } = require('./middleware/rateLimit');

// Express 4 不会自动捕获 async 路由的 Promise 异常。
// 在加载 routes/* 之前包装 Router，确保异步错误进入统一 errorHandler。
function patchAsyncRouter(expressInstance) {
  const originalRouter = expressInstance.Router;
  const methods = ['get', 'post', 'put', 'delete', 'patch'];

  expressInstance.Router = function createPatchedRouter() {
    const router = originalRouter.apply(expressInstance, arguments);

    methods.forEach(method => {
      const originalMethod = router[method];
      router[method] = function patchedRouteMethod() {
        const args = Array.prototype.slice.call(arguments);
        const wrapped = args.map(arg => {
          if (typeof arg !== 'function' || arg.length === 4) return arg;
          return function wrappedHandler(req, res, next) {
            try {
              const result = arg(req, res, next);
              if (result && typeof result.catch === 'function') result.catch(next);
            } catch (err) {
              next(err);
            }
          };
        });
        return originalMethod.apply(this, wrapped);
      };
    });

    return router;
  };
};

patchAsyncRouter(express);

const app = express();
const PORT = process.env.PORT || 3000;

// 环境检查：开发环境允许本地MySQL空密码，生产环境必须配置DB_PASSWORD
const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME'];
if (process.env.NODE_ENV === 'production') requiredEnvVars.push('DB_PASSWORD');
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ 缺少必需的环境变量:', missingVars.join(', '));
  console.error('请复制 .env.example 为 .env 并填写配置');
  process.exit(1);
}

// 中间件
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://wfr.ccvo.top', 'https://servicewechat.com']
    : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// 在Nginx/反向代理后部署时，确保 req.ip 正确用于限流和日志
app.set('trust proxy', 1);

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      const logLevel = res.statusCode >= 400 ? 'ERROR' : 'INFO';
      console.log(`[${logLevel}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// 静态文件 --- 管理后台
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// 管理后台首页
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'index.html'));
});

// 限流：先对公开高成本接口做严格限制，再对管理接口做常规限制
app.use('/api/chat/generate', createRateLimiter({
  scope: 'chat-generate',
  windowMs: 60 * 1000,
  max: 10,
  message: 'AI生成请求过于频繁，请稍后再试'
}));
app.use('/api', createRateLimiter({
  scope: 'api-global',
  windowMs: 60 * 1000,
  max: 120,
  message: '请求过于频繁，请稍后再试'
}));

// API路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ai-settings', require('./routes/ai-settings'));
app.use('/api/products', require('./routes/products'));
app.use('/api/apis', require('./routes/apis'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/banned-words', require('./routes/banned-words'));

// 健康检查（增强版）
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };

  // 检查数据库连接
  try {
    const pool = require('./db');
    await pool.query('SELECT 1');
    health.database = 'connected';
  } catch (err) {
    health.database = 'disconnected';
    health.status = 'degraded';
  }

  res.json({ code: 200, data: health, message: 'AI小福建站客服助手运行正常' });
});

// 404处理
app.use(notFoundHandler);

// 统一错误处理
app.use(errorHandler);

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  🤖 AI小福建站接单客服助手');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  管理后台: http://localhost:${PORT}/admin`);
  console.log(`  绑定域名: ${process.env.DOMAIN || 'wfr.ccvo.top'}`);
  console.log('========================================');
});
