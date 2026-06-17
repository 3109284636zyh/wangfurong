const express = require('express');
const pool = require('../db');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// 获取违禁词列表
router.get('/', adminAuth, async (req, res) => {
  const { category } = req.query;
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
  const { word, category, is_regex } = req.body;
  if (!word) return res.json({ code: 400, message: '违禁词不能为空' });
  await pool.query(
    'INSERT INTO banned_words (word, category, is_regex) VALUES (?,?,?)',
    [word, category || '通用', is_regex ? 1 : 0]
  );
  res.json({ code: 200, message: '违禁词已添加' });
});

// 更新违禁词
router.put('/:id', adminAuth, async (req, res) => {
  const { word, category, is_regex, is_active } = req.body;
  await pool.query(
    'UPDATE banned_words SET word=?, category=?, is_regex=?, is_active=? WHERE id=?',
    [word, category, is_regex ? 1 : 0, is_active ? 1 : 0, req.params.id]
  );
  res.json({ code: 200, message: '已更新' });
});

// 删除违禁词
router.delete('/:id', adminAuth, async (req, res) => {
  await pool.query('DELETE FROM banned_words WHERE id=?', [req.params.id]);
  res.json({ code: 200, message: '已删除' });
});

// 内容检测（测试用）
router.post('/check', adminAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.json({ code: 400, message: '请输入要检测的内容' });

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
