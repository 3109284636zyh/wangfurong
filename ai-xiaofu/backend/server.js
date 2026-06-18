require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// 环境检查
const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
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
