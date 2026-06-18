const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { adminAuth } = require('../middleware/auth');
const { badRequest, normalizeString } = require('../middleware/validate');

const router = express.Router();
const DEFAULT_ADMIN_PASSWORD_HASH = '$2a$10$OZtRoR5svU3JYeS2aIPVmOqgISo5T5f8lQaAnzyf30zdLKnp5W29a';

async function getAdmin() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin (
      id INT PRIMARY KEY AUTO_INCREMENT,
      password VARCHAR(255) NOT NULL COMMENT 'bcrypt加密密码',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [admins] = await pool.query('SELECT * FROM admin LIMIT 1');
  if (admins.length > 0) return admins[0];

  await pool.query('INSERT INTO admin (password) VALUES (?)', [DEFAULT_ADMIN_PASSWORD_HASH]);
  const [[admin]] = await pool.query('SELECT * FROM admin LIMIT 1');
  return admin;
}

// 登录（仅密码，无用户名---文档2.1要求）
router.post('/login', async (req, res) => {
  const password = normalizeString(req.body.password, 200);
  if (!password) {
    return badRequest(res, '请输入密码');
  }

  try {
    const admin = await getAdmin();

    const isMatch = bcrypt.compareSync(password, admin.password);
    if (!isMatch) {
      return res.json({ code: 400, message: '密码不正确，请重新输入' });
    }

    const token = jwt.sign(
      { id: admin.id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }  // 30分钟超时
    );

    res.json({ code: 200, message: '登录成功', data: { token } });
  } catch (err) {
    console.error('登录错误:', err);
    res.json({ code: 500, message: '服务器错误' });
  }
});

// 验证token
router.get('/verify', adminAuth, (req, res) => {
  res.json({ code: 200, message: 'token有效' });
});

// 注意：按文档2.1要求，禁止后台修改登录密码，固定为zyh123456

module.exports = router;
