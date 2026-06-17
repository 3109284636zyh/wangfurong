const express = require('express');
const axios = require('axios');
const pool = require('../db');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// 获取所有API配置
router.get('/', adminAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM api_configs ORDER BY is_primary DESC, is_active DESC');
  // 隐藏key
  const safe = rows.map(r => ({
    ...r,
    api_key: r.api_key ? r.api_key.substring(0, 8) + '****' + r.api_key.slice(-4) : ''
  }));
  res.json({ code: 200, data: safe });
});

// 添加API
router.post('/', adminAuth, async (req, res) => {
  const { name, api_type, api_key, api_url, model, temperature, max_tokens, timeout_seconds } = req.body;
  if (!name || !api_key || !api_url || !model) {
    return res.json({ code: 400, message: '请填写完整的API信息' });
  }
  await pool.query(
    `INSERT INTO api_configs (name, api_type, api_key, api_url, model, temperature, max_tokens, timeout_seconds)
     VALUES (?,?,?,?,?,?,?,?)`,
    [name, api_type || 'deepseek', api_key, api_url, model, temperature || 0.7, max_tokens || 2000, timeout_seconds || 30]
  );
  res.json({ code: 200, message: 'API已添加' });
});

// 更新API
router.put('/:id', adminAuth, async (req, res) => {
  const { name, api_type, api_key, api_url, model, temperature, max_tokens, timeout_seconds, is_active } = req.body;
  const [rows] = await pool.query('SELECT * FROM api_configs WHERE id=?', [req.params.id]);
  if (rows.length === 0) return res.json({ code: 404, message: 'API不存在' });

  const newKey = api_key && !api_key.includes('****') ? api_key : rows[0].api_key;

  await pool.query(
    `UPDATE api_configs SET name=?, api_type=?, api_key=?, api_url=?, model=?, temperature=?, max_tokens=?, timeout_seconds=?, is_active=? WHERE id=?`,
    [name, api_type, newKey, api_url, model, temperature, max_tokens, timeout_seconds, is_active ?? 1, req.params.id]
  );
  res.json({ code: 200, message: 'API已更新' });
});

// 删除API
router.delete('/:id', adminAuth, async (req, res) => {
  await pool.query('DELETE FROM api_configs WHERE id=?', [req.params.id]);
  res.json({ code: 200, message: 'API已删除' });
});

// 设为默认主API
router.put('/:id/primary', adminAuth, async (req, res) => {
  await pool.query('UPDATE api_configs SET is_primary=0');
  await pool.query('UPDATE api_configs SET is_primary=1, is_active=1 WHERE id=?', [req.params.id]);
  res.json({ code: 200, message: '已设为主API' });
});

// API连通性测试（文档2.4要求）
router.post('/:id/test', adminAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM api_configs WHERE id=?', [req.params.id]);
  if (rows.length === 0) return res.json({ code: 404, message: 'API不存在' });

  const api = rows[0];
  const startTime = Date.now();
  try {
    const response = await axios.post(api.api_url, {
      model: api.model,
      messages: [{ role: 'user', content: '你好，请回复"测试成功"' }],
      max_tokens: 20,
      temperature: 0.1
    }, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api.api_key}` },
      timeout: 10000
    });
    const elapsed = Date.now() - startTime;
    res.json({
      code: 200,
      message: '连接成功',
      data: {
        response: response.data.choices[0].message.content,
        response_time_ms: elapsed,
        model: api.model
      }
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    res.json({
      code: 500,
      message: '连接失败：' + (err.response?.data?.error?.message || err.message),
      data: { response_time_ms: elapsed }
    });
  }
});

module.exports = router;
