const express = require('express');
const pool = require('../db');
const { adminAuth } = require('../middleware/auth');
const { badRequest, normalizeString, validateId, validateRequiredString } = require('../middleware/validate');

const router = express.Router();

// 获取违禁词列表
router.get('/', adminAuth, async (req, res) => {
  const category = normalizeString(req.query.category, 50);
  let sql = 'SELECT * FROM banned_words WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category=?'; params.push(category); }
  sql += ' ORDER BY category, id';
  const [rows] = await pool.query(sql, params);
  res.json({ code: 200, data: rows });
});

// 获取违禁词分类
router.get('/categories', adminAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT DISTINCT category FROM banned_words ORDER BY category');
  res.json({ code: 200, data: rows.map(r => r.category) });
});

// 添加违禁词
router.post('/', adminAuth, async (req, res) => {
  const wordResult = validateRequiredString(req.body.word, '违禁词', 200);
  if (!wordResult.ok) return badRequest(res, wordResult.message);
  await pool.query(
    'INSERT INTO banned_words (word, category, is_regex) VALUES (?,?,?)',
    [wordResult.value, normalizeString(req.body.category, 50) || '通用', req.body.is_regex ? 1 : 0]
  );
  res.json({ code: 200, message: '违禁词已添加' });
});

// 更新违禁词
router.put('/:id', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, '违禁词ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  const wordResult = validateRequiredString(req.body.word, '违禁词', 200);
  if (!wordResult.ok) return badRequest(res, wordResult.message);
  await pool.query(
    'UPDATE banned_words SET word=?, category=?, is_regex=?, is_active=? WHERE id=?',
    [wordResult.value, normalizeString(req.body.category, 50) || '通用', req.body.is_regex ? 1 : 0, req.body.is_active ? 1 : 0, idResult.value]
  );
  res.json({ code: 200, message: '已更新' });
});

// 删除违禁词
router.delete('/:id', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, '违禁词ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  await pool.query('DELETE FROM banned_words WHERE id=?', [idResult.value]);
  res.json({ code: 200, message: '已删除' });
});

// 内容检测（测试用）
router.post('/check', adminAuth, async (req, res) => {
  const text = normalizeString(req.body.text, 10000);
  if (!text) return badRequest(res, '请输入要检测的内容');

  const [words] = await pool.query('SELECT * FROM banned_words WHERE is_active=1');
  const violations = [];
  for (const w of words) {
    if (w.is_regex) {
      try { if (new RegExp(w.word, 'gi').test(text)) violations.push({ word: w.word, category: w.category }); } catch (e) {}
    } else {
      if (text.includes(w.word)) violations.push({ word: w.word, category: w.category });
    }
  }
  res.json({
    code: 200,
    data: {
      has_violation: violations.length > 0,
      violations,
      count: violations.length
    }
  });
});

module.exports = router;
