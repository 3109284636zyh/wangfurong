require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
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

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'AI小福建站客服助手运行正常', time: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    res.status(404).json({ code: 404, message: '接口不存在' });
  }
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  🤖 AI小福建站接单客服助手');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  管理后台: http://localhost:${PORT}/admin`);
  console.log(`  绑定域名: ${process.env.DOMAIN || 'wfr.ccvo.top'}`);
  console.log('========================================');
});
