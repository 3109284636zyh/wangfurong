const express = require('express');
const pool = require('../db');
const { badRequest, clampNumber, normalizePage, normalizeString } = require('../middleware/validate');
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
  const allowedChatModes = ['daily', 'friend', 'bestie', 'brother', 'lover'];
  const personality = normalizeString(req.body.personality, 5000);
  const reply_max_length = Math.round(clampNumber(req.body.reply_max_length, 50, 2000, 500));
  const reply_in_paragraphs = req.body.reply_in_paragraphs ? 1 : 0;
  const proactive_follow_up = req.body.proactive_follow_up ? 1 : 0;
  const ban_internet_slang = req.body.ban_internet_slang ? 1 : 0;
  const ban_marketing_words = req.body.ban_marketing_words ? 1 : 0;
  const reply_tone = normalizeString(req.body.reply_tone, 50) || '专业温和';
  const memory_enabled = req.body.memory_enabled ? 1 : 0;
  const memory_retention_days = Math.round(clampNumber(req.body.memory_retention_days, 1, 365, 30));
  const default_opening = normalizeString(req.body.default_opening, 2000);
  const fallback_reply = normalizeString(req.body.fallback_reply, 2000);
  const custom_system_prompt = normalizeString(req.body.custom_system_prompt, 20000);
  const chat_mode = allowedChatModes.includes(req.body.chat_mode) ? req.body.chat_mode : 'friend';
  const ai_temperature = clampNumber(req.body.ai_temperature, 0, 2, 0.7);
  const ai_interests = normalizeString(req.body.ai_interests, 5000);
  const enable_human_mode = req.body.enable_human_mode ? 1 : 0;
  const human_mode_tip = normalizeString(req.body.human_mode_tip, 1000);

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
    const { page, limit, offset } = normalizePage(req.query);
    const [rows] = await pool.query(
      'SELECT * FROM ai_memories ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM ai_memories');
    res.json({ code: 200, data: { list: rows, total, page } });
  } catch (err) {
    console.error(err);
    res.json({ code: 500, message: '获取失败' });
  }
});

module.exports = router;
