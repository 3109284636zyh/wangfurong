const express = require('express');
const axios = require('axios');
const pool = require('../db');
const { adminAuth } = require('../middleware/auth');
const { badRequest, clampNumber, normalizeString, validateId, validateRequiredString, validateUrl } = require('../middleware/validate');

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
  const nameResult = validateRequiredString(req.body.name, 'API名称', 100);
  if (!nameResult.ok) return badRequest(res, nameResult.message);
  const keyResult = validateRequiredString(req.body.api_key, 'API Key', 500);
  if (!keyResult.ok) return badRequest(res, keyResult.message);
  const urlResult = validateUrl(req.body.api_url, 'API地址');
  if (!urlResult.ok) return badRequest(res, urlResult.message);
  const modelResult = validateRequiredString(req.body.model, '模型名称', 100);
  if (!modelResult.ok) return badRequest(res, modelResult.message);

  await pool.query(
    `INSERT INTO api_configs (name, api_type, api_key, api_url, model, temperature, max_tokens, timeout_seconds)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      nameResult.value,
      normalizeString(req.body.api_type, 50) || 'deepseek',
      keyResult.value,
      urlResult.value,
      modelResult.value,
      clampNumber(req.body.temperature, 0, 2, 0.7),
      Math.round(clampNumber(req.body.max_tokens, 100, 32000, 2000)),
      Math.round(clampNumber(req.body.timeout_seconds, 5, 120, 30))
    ]
  );
  res.json({ code: 200, message: 'API已添加' });
});

// 更新API
router.put('/:id', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, 'API ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  const nameResult = validateRequiredString(req.body.name, 'API名称', 100);
  if (!nameResult.ok) return badRequest(res, nameResult.message);
  const urlResult = validateUrl(req.body.api_url, 'API地址');
  if (!urlResult.ok) return badRequest(res, urlResult.message);
  const modelResult = validateRequiredString(req.body.model, '模型名称', 100);
  if (!modelResult.ok) return badRequest(res, modelResult.message);

  const [rows] = await pool.query('SELECT * FROM api_configs WHERE id=?', [idResult.value]);
  if (rows.length === 0) return res.json({ code: 404, message: 'API不存在' });

  const apiKeyInput = normalizeString(req.body.api_key, 500);
  const newKey = apiKeyInput && !apiKeyInput.includes('****') ? apiKeyInput : rows[0].api_key;
  if (!newKey) return badRequest(res, 'API Key不能为空');

  await pool.query(
    `UPDATE api_configs SET name=?, api_type=?, api_key=?, api_url=?, model=?, temperature=?, max_tokens=?, timeout_seconds=?, is_active=? WHERE id=?`,
    [
      nameResult.value,
      normalizeString(req.body.api_type, 50) || 'deepseek',
      newKey,
      urlResult.value,
      modelResult.value,
      clampNumber(req.body.temperature, 0, 2, 0.7),
      Math.round(clampNumber(req.body.max_tokens, 100, 32000, 2000)),
      Math.round(clampNumber(req.body.timeout_seconds, 5, 120, 30)),
      req.body.is_active === 0 || req.body.is_active === false ? 0 : 1,
      idResult.value
    ]
  );
  res.json({ code: 200, message: 'API已更新' });
});

// 删除API
router.delete('/:id', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, 'API ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  await pool.query('DELETE FROM api_configs WHERE id=?', [idResult.value]);
  res.json({ code: 200, message: 'API已删除' });
});

// 设为默认主API
router.put('/:id/primary', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, 'API ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  await pool.query('UPDATE api_configs SET is_primary=0');
  await pool.query('UPDATE api_configs SET is_primary=1, is_active=1 WHERE id=?', [idResult.value]);
  res.json({ code: 200, message: '已设为主API' });
});

// API连通性测试（文档2.4要求）
router.post('/:id/test', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, 'API ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  const [rows] = await pool.query('SELECT * FROM api_configs WHERE id=?', [idResult.value]);
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
