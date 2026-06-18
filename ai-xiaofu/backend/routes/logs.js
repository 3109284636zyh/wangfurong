const express = require('express');
const pool = require('../db');
const { adminAuth } = require('../middleware/auth');
const { badRequest, normalizePage, normalizeString, validateId } = require('../middleware/validate');

const router = express.Router();

// 获取对话日志列表（支持搜索）
router.get('/', adminAuth, async (req, res) => {
  const { page, limit, offset } = normalizePage(req.query);
  const keyword = normalizeString(req.query.keyword, 100);
  const date_from = normalizeString(req.query.date_from, 10);
  const date_to = normalizeString(req.query.date_to, 10);

  let sql = 'SELECT * FROM chat_logs WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM chat_logs WHERE 1=1';
  const params = [];
  const countParams = [];

  if (keyword) {
    sql += ' AND (user_question LIKE ? OR ai_reply LIKE ?)';
    countSql += ' AND (user_question LIKE ? OR ai_reply LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
    countParams.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (date_from) {
    sql += ' AND created_at >= ?';
    countSql += ' AND created_at >= ?';
    params.push(date_from);
    countParams.push(date_from);
  }
  if (date_to) {
    sql += ' AND created_at <= ?';
    countSql += ' AND created_at <= ?';
    params.push(date_to + ' 23:59:59');
    countParams.push(date_to + ' 23:59:59');
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(sql, params);
  const [[{ total }]] = await pool.query(countSql, countParams);

  res.json({ code: 200, data: { list: rows, total, page } });
});

// 删除日志
router.delete('/:id', adminAuth, async (req, res) => {
  const idResult = validateId(req.params.id, '日志ID');
  if (!idResult.ok) return badRequest(res, idResult.message);
  await pool.query('DELETE FROM chat_logs WHERE id=?', [idResult.value]);
  res.json({ code: 200, message: '日志已删除' });
});

// 批量删除
router.post('/batch-delete', adminAuth, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (ids.length === 0) return badRequest(res, '请选择要删除的日志');
  if (ids.length > 200) return badRequest(res, '一次最多删除200条日志');
  const cleanIds = [];
  for (const id of ids) {
    const idResult = validateId(id, '日志ID');
    if (!idResult.ok) return badRequest(res, idResult.message);
    cleanIds.push(idResult.value);
  }
  await pool.query(`DELETE FROM chat_logs WHERE id IN (${cleanIds.map(() => '?').join(',')})`, cleanIds);
  res.json({ code: 200, message: `已删除 ${cleanIds.length} 条日志` });
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
