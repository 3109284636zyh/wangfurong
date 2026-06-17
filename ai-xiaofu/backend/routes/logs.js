const express = require('express');
const pool = require('../db');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// 获取对话日志列表（支持搜索）
router.get('/', adminAuth, async (req, res) => {
  const { keyword, page = 1, limit = 50, date_from, date_to } = req.query;
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM chat_logs WHERE 1=1';
  const params = [];

  if (keyword) {
    sql += ' AND (user_question LIKE ? OR ai_reply LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (date_from) {
    sql += ' AND created_at >= ?';
    params.push(date_from);
  }
  if (date_to) {
    sql += ' AND created_at <= ?';
    params.push(date_to + ' 23:59:59');
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const [rows] = await pool.query(sql, params);
  const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM chat_logs');

  res.json({ code: 200, data: { list: rows, total, page: Number(page) } });
});

// 删除日志
router.delete('/:id', adminAuth, async (req, res) => {
  await pool.query('DELETE FROM chat_logs WHERE id=?', [req.params.id]);
  res.json({ code: 200, message: '日志已删除' });
});

// 批量删除
router.post('/batch-delete', adminAuth, async (req, res) => {
  const { ids } = req.body;
  if (!ids || ids.length === 0) return res.json({ code: 400, message: '请选择要删除的日志' });
  await pool.query(`DELETE FROM chat_logs WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  res.json({ code: 200, message: `已删除 ${ids.length} 条日志` });
});

// 导出日志
router.get('/export', adminAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT user_question, ai_reply, api_name, response_time_ms, is_violation, created_at FROM chat_logs ORDER BY created_at DESC');
  res.json({ code: 200, data: rows });
});

// 统计数据
router.get('/stats', adminAuth, async (req, res) => {
  const [[total]] = await pool.query('SELECT COUNT(*) as count FROM chat_logs');
  const [[today]] = await pool.query("SELECT COUNT(*) as count FROM chat_logs WHERE DATE(created_at)=CURDATE()");
  const [[violation]] = await pool.query('SELECT COUNT(*) as count FROM chat_logs WHERE is_violation=1');
  const [[avgTime]] = await pool.query('SELECT AVG(response_time_ms) as avg FROM chat_logs');

  res.json({
    code: 200,
    data: {
      total: total.count,
      today: today.count,
      violations: violation.count,
      avg_response_ms: Math.round(avgTime.avg || 0)
    }
  });
});

module.exports = router;
