const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// 登录（仅密码，无用户名---文档2.1要求）
router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.json({ code: 400, message: '请输入密码' });
  }

  try {
    const [admins] = await pool.query('SELECT * FROM admin LIMIT 1');
    if (admins.length === 0) {
      return res.json({ code: 500, message: '系统未初始化' });
    }

    const isMatch = bcrypt.compareSync(password, admins[0].password);
    if (!isMatch) {
      return res.json({ code: 400, message: '密码不正确，请重新输入' });
    }

    const token = jwt.sign(
      { id: admins[0].id, role: 'admin' },
      process.env.JWT_SECRET || 'xiaofu_jwt_secret_2024_secure',
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
