const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ai_xiaofu',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
});

// 测试连接
pool.getConnection()
  .then(conn => {
    console.log('✓ MySQL数据库连接成功');
    conn.release();
  })
  .catch(err => {
    console.error('✗ MySQL连接失败:', err.message);
    console.error('请确保MySQL已启动，并执行了 database.sql');
  });

module.exports = pool;
