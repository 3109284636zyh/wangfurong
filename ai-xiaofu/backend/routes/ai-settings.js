const express = require('express');
const pool = require('../db');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// 获取AI设置
router.get('/', adminAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ai_settings ORDER BY id DESC LIMIT 1');
    res.json({ code: 200, data: rows[0] || {} });
  } catch (err) {
    console.error(err);
    res.json({ code: 500, message: '获取失败' });
  }
});

// 更新AI设置（实时生效，保存后小程序立即同步---文档2.2）
router.put('/', adminAuth, async (req, res) => {
  const {
    personality, reply_max_length, reply_in_paragraphs,
    proactive_follow_up, ban_internet_slang, ban_marketing_words,
    reply_tone, memory_enabled, memory_retention_days,
    default_opening, fallback_reply, custom_system_prompt,
    chat_mode, ai_temperature, ai_interests,
    enable_human_mode, human_mode_tip
  } = req.body;

  try {
    // 解析兴趣爱好格式：将多行文本转为JSON
    let interestsJson = ai_interests;
    if (ai_interests && typeof ai_interests === 'string' && !ai_interests.startsWith('{')) {
      try {
        const lines = ai_interests.split('\n').filter(line => line.trim());
        const parsed = {};
        for (const line of lines) {
          const colonIndex = line.indexOf('：') !== -1 ? line.indexOf('：') : line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            if (key && value) parsed[key] = value;
          }
        }
        interestsJson = JSON.stringify(parsed);
      } catch (e) {
        console.error('兴趣爱好解析失败:', e);
      }
    }

    const [existing] = await pool.query('SELECT id FROM ai_settings LIMIT 1');
    if (existing.length > 0) {
      await pool.query(`
        UPDATE ai_settings SET
          personality=?, reply_max_length=?, reply_in_paragraphs=?,
          proactive_follow_up=?, ban_internet_slang=?, ban_marketing_words=?,
          reply_tone=?, memory_enabled=?, memory_retention_days=?,
          default_opening=?, fallback_reply=?, custom_system_prompt=?,
          chat_mode=?, ai_temperature=?, ai_interests=?,
          enable_human_mode=?, human_mode_tip=?
        WHERE id=?
      `, [personality, reply_max_length, reply_in_paragraphs,
          proactive_follow_up, ban_internet_slang, ban_marketing_words,
          reply_tone, memory_enabled, memory_retention_days,
          default_opening, fallback_reply, custom_system_prompt,
          chat_mode, ai_temperature, interestsJson,
          enable_human_mode, human_mode_tip, existing[0].id]);
    } else {
      await pool.query(`
        INSERT INTO ai_settings (personality, reply_max_length, reply_in_paragraphs,
          proactive_follow_up, ban_internet_slang, ban_marketing_words,
          reply_tone, memory_enabled, memory_retention_days,
          default_opening, fallback_reply, custom_system_prompt,
          chat_mode, ai_temperature, ai_interests,
          enable_human_mode, human_mode_tip)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [personality, reply_max_length, reply_in_paragraphs,
          proactive_follow_up, ban_internet_slang, ban_marketing_words,
          reply_tone, memory_enabled, memory_retention_days,
          default_opening, fallback_reply, custom_system_prompt,
          chat_mode, ai_temperature, interestsJson,
          enable_human_mode, human_mode_tip]);
    }

    // 清理过期记忆
    if (memory_retention_days) {
      await pool.query(
        'DELETE FROM ai_memories WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [memory_retention_days]
      );
    }

    res.json({ code: 200, message: 'AI设置已保存，小程序端实时生效' });
  } catch (err) {
    console.error(err);
    res.json({ code: 500, message: '保存失败' });
  }
});

// 清空全部记忆
router.post('/clear-memories', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM ai_memories');
    res.json({ code: 200, message: '全部记忆已清空' });
  } catch (err) {
    console.error(err);
    res.json({ code: 500, message: '清空失败' });
  }
});

// 查看历史记忆
router.get('/memories', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const [rows] = await pool.query(
      'SELECT * FROM ai_memories ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [Number(limit), Number(offset)]
    );
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM ai_memories');
    res.json({ code: 200, data: { list: rows, total, page: Number(page) } });
  } catch (err) {
    console.error(err);
    res.json({ code: 500, message: '获取失败' });
  }
});

module.exports = router;
