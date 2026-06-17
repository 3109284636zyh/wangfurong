const express = require('express');
const axios = require('axios');
const pool = require('../db');
const router = express.Router();

// ==================== AI小福模式 系统提示词 ====================
async function buildChatSystemPrompt(sessionId) {
  const [[settings]] = await pool.query('SELECT * FROM ai_settings ORDER BY id DESC LIMIT 1');

  if (settings && settings.custom_system_prompt) {
    return settings.custom_system_prompt;
  }

  var prompt = '';
  prompt += '你是小福，一个AI生活伴侣和知心朋友。\n';

  if (settings) {
    prompt += '你的性格：' + (settings.personality || '温柔体贴、善解人意、乐观开朗') + '\n';
    prompt += '你的说话语气：' + (settings.reply_tone || '温柔') + '，温暖可爱，偶尔用"呢""哦""呀"等语气词\n';
    if (settings.reply_in_paragraphs) prompt += '回复需要适当分段。\n';
    if (settings.ban_internet_slang) prompt += '避免使用过多网络流行语。\n';
    if (settings.reply_max_length) prompt += '每次回复不超过' + settings.reply_max_length + '字。\n';
  }

  prompt += '\n你是一个贴心的AI朋友，像闺蜜/兄弟一样和用户交流。';
  prompt += '你要记住用户告诉你的重要信息（名字、喜好、经历等），在后续对话中自然提起，让用户感到被重视。';
  prompt += '保持温暖友善的态度，多关心用户的生活和心情。';
  prompt += '你可以聊任何话题：日常、心情、工作、兴趣爱好、梦想、烦恼...什么都可以聊。';
  prompt += '适当使用emoji表情让对话更生动 😊💕';

  // 获取用户记忆（从小福聊天中提取的个人信息）
  if (sessionId) {
    var [memories] = await pool.query(
      'SELECT role, content FROM ai_memories WHERE session_id=? ORDER BY created_at DESC LIMIT 10',
      [sessionId]
    );
    if (memories.length > 0) {
      prompt += '\n\n你和这个用户最近的对话：\n';
      for (var i = 0; i < memories.length; i++) {
        var m = memories[i];
        var label = m.role === 'user' ? '用户' : '你(小福)';
        prompt += label + '：' + m.content + '\n';
      }
    }
  }

  var now = new Date();
  prompt += '\n当前时间：' + now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  return prompt;
}

// ==================== 4.1 强制拼接逻辑（不可改动） ====================
async function buildSystemPrompt() {
  const [[settings]] = await pool.query('SELECT * FROM ai_settings ORDER BY id DESC LIMIT 1');

  // 如果有自定义提示词，直接使用
  if (settings && settings.custom_system_prompt) {
    return settings.custom_system_prompt;
  }

  // === 前置固定规则 ===
  let prompt = `【前置固定规则】你是电商平台建站接单客服，禁止任何站外引流、禁止留微信/电话/第三方链接，严格遵守闲鱼、淘宝、拼多多平台规则，严禁违规话术。\n`;

  // === AI人设 ===
  if (settings) {
    prompt += `\n【AI人设】${settings.personality || '你是一个专业耐心的建站客服。'}\n`;
    prompt += `回复语气：${settings.reply_tone || '专业温和'}。`;
    if (settings.reply_max_length) prompt += `每次回复不超过${settings.reply_max_length}字。`;
    if (settings.reply_in_paragraphs) prompt += `回复需要适当分段。`;
    if (settings.ban_internet_slang) prompt += `禁止使用网络流行语。`;
    if (settings.ban_marketing_words) prompt += `禁止使用任何营销违禁词。`;
  }

  // === 产品报价库数据 ===
  const [products] = await pool.query(
    `SELECT p.*, pc.name as category_name FROM products p
     LEFT JOIN product_categories pc ON p.category_id=pc.id
     WHERE p.is_active=1 ORDER BY pc.sort_order`
  );

  if (products.length > 0) {
    prompt += `\n\n【产品报价库数据】以下是所有可提供的建站服务产品及报价：\n`;
    for (const p of products) {
      prompt += `- [${p.category_name || '未分类'}] ${p.name}：`;
      if (p.description) prompt += `${p.description}。`;
      prompt += `标准价${p.standard_price}元`;
      if (p.discount_price && p.discount_price < p.standard_price) {
        prompt += `，优惠价${p.discount_price}元`;
      }
      prompt += `。`;
      if (p.included_services) prompt += `包含：${p.included_services}。`;
      if (p.excluded_services) prompt += `不包含：${p.excluded_services}。`;
      if (p.delivery_days) prompt += `交付周期：${p.delivery_days}。`;
      if (p.after_sales) prompt += `售后：${p.after_sales}。`;
      prompt += `\n`;
    }
  }

  // === 输出要求 ===
  prompt += `\n【输出要求】直接输出一条可以直接复制发送给客户的最终回复，不要解释、不要多余备注、不要markdown格式，话术自然贴合电商客服，专业回答建站相关专业问题，结合产品报价精准回复。`;

  return prompt;
}

// ==================== 4.2 违禁词风控拦截 ====================
async function checkBannedWords(text) {
  const [words] = await pool.query('SELECT * FROM banned_words WHERE is_active=1');
  const violations = [];
  for (const w of words) {
    if (w.is_regex) {
      try { if (new RegExp(w.word, 'gi').test(text)) violations.push(w.word); } catch (e) {}
    } else {
      if (text.includes(w.word)) violations.push(w.word);
    }
  }
  return violations;
}

// ==================== 4.3 API优先级逻辑 ====================
async function getActiveApi() {
  // 优先获取主API
  const [primary] = await pool.query(
    'SELECT * FROM api_configs WHERE is_primary=1 AND is_active=1 LIMIT 1'
  );
  if (primary.length > 0) return primary[0];

  // 没有主API，获取第一个启用的
  const [any] = await pool.query(
    'SELECT * FROM api_configs WHERE is_active=1 ORDER BY weight DESC LIMIT 1'
  );
  if (any.length > 0) return any[0];

  return null;
}

async function getBackupApi(currentApiId) {
  const [backup] = await pool.query(
    'SELECT * FROM api_configs WHERE is_active=1 AND id!=? ORDER BY weight DESC LIMIT 1',
    [currentApiId]
  );
  return backup.length > 0 ? backup[0] : null;
}

async function callApi(api, messages) {
  const response = await axios.post(api.api_url, {
    model: api.model,
    messages: messages,
    temperature: api.temperature,
    max_tokens: api.max_tokens
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${api.api_key}`
    },
    timeout: (api.timeout_seconds || 30) * 1000
  });
  return response.data.choices[0].message.content;
}

// ==================== 核心：一键生成回复 ====================
router.post('/generate', async (req, res) => {
  const { question, session_id, mode } = req.body;
  const isChatMode = mode === 'chat';  // chat=AI小福模式, work/其他=客服模式

  if (!question || !question.trim()) {
    return res.json({ code: 400, message: isChatMode ? '请输入你想说的话' : '请输入客户咨询内容' });
  }

  const startTime = Date.now();
  let apiUsed = '';
  let finalReply = '';
  let isViolation = false;
  let maxRetries = 3;

  try {
    // 获取AI设置
    const [[settings]] = await pool.query('SELECT * FROM ai_settings ORDER BY id DESC LIMIT 1');

    // 检查是否乱码/无效输入
    const trimmed = question.trim();
    const invalidPattern = /^[^一-龥a-zA-Z0-9]+$/;
    if (trimmed.length < 2 || invalidPattern.test(trimmed)) {
      if (isChatMode) {
        finalReply = '你好呀~ 小福在这呢！你想和我说什么呢？😊';
      } else {
        finalReply = settings?.fallback_reply || '您好，您的问题我需要进一步了解才能给您准确答复。方便详细描述一下您的需求吗？';
      }
      await saveLog(question, finalReply, '兜底回复', Date.now() - startTime, 0);
      return res.json({ code: 200, data: { reply: finalReply, type: 'fallback' } });
    }

    // 根据模式构建不同的系统提示词
    let systemPrompt;
    if (isChatMode) {
      systemPrompt = await buildChatSystemPrompt(session_id);
    } else {
      systemPrompt = await buildSystemPrompt();
    }

    // 获取上下文记忆
    const messages = [{ role: 'system', content: systemPrompt }];
    if (settings?.memory_enabled && session_id) {
      const [memories] = await pool.query(
        'SELECT role, content FROM ai_memories WHERE session_id=? ORDER BY created_at ASC LIMIT 20',
        [session_id]
      );
      for (const m of memories) {
        messages.push({ role: m.role, content: m.content });
      }
    }

    // 拼接用户提问
    messages.push({ role: 'user', content: question });

    // 调用API（4.3优先级逻辑）
    const primaryApi = await getActiveApi();
    if (!primaryApi) {
      finalReply = isChatMode ? '小福暂时不在线，请稍后再说吧~' : 'AI服务未配置，请联系管理员在后台添加API。';
      return res.json({ code: 500, message: 'AI服务未配置' });
    }

    // 尝试主API，超时自动切换备用
    try {
      finalReply = await callApi(primaryApi, messages);
      apiUsed = primaryApi.name;
    } catch (primaryError) {
      console.log('主API(' + primaryApi.name + ')调用失败:', primaryError.message);
      const backupApi = await getBackupApi(primaryApi.id);
      if (backupApi) {
        try {
          finalReply = await callApi(backupApi, messages);
          apiUsed = backupApi.name + '(备用)';
        } catch (backupError) {
          console.log('备用API(' + backupApi.name + ')也失败:', backupError.message);
          finalReply = isChatMode
            ? '嗯...小福现在有点累了，让我休息一下再和你聊好吗？'
            : (settings?.fallback_reply || '抱歉，AI服务暂时不可用，请稍后重试。');
          apiUsed = '全部失败';
        }
      } else {
        finalReply = isChatMode
          ? '小福现在不在状态呢，等会再来找我聊天吧~'
          : (settings?.fallback_reply || '抱歉，AI服务暂时不可用，请稍后重试。');
        apiUsed = '无备用API';
      }
    }

    // 客服模式才做违禁词风控检测，AI小福聊天模式跳过
    if (!isChatMode) {
      const violations = await checkBannedWords(finalReply);
      if (violations.length > 0 && maxRetries > 0) {
        isViolation = true;
        messages.push({ role: 'assistant', content: finalReply });
        messages.push({ role: 'user', content: '请重新回复，你的回复中包含以下违规词汇：' + violations.join('、') + '。请去除这些词汇后重新生成合规回复。' });
        try {
          const retryApi = await getActiveApi();
          finalReply = await callApi(retryApi, messages);
          apiUsed += '(风控重生成)';
          const recheckViolations = await checkBannedWords(finalReply);
          if (recheckViolations.length > 0) {
            isViolation = true;
            for (const w of recheckViolations) {
              finalReply = finalReply.replace(new RegExp(w, 'g'), '***');
            }
          } else {
            isViolation = false;
          }
        } catch (e) {
          console.log('重生成失败:', e.message);
        }
      }
    }

    // 保存上下文记忆
    if (settings?.memory_enabled && session_id) {
      await pool.query('INSERT INTO ai_memories (session_id, role, content) VALUES (?,?,?)', [session_id, 'user', question]);
      await pool.query('INSERT INTO ai_memories (session_id, role, content) VALUES (?,?,?)', [session_id, 'assistant', finalReply]);
    }

    // 保存日志
    const elapsed = Date.now() - startTime;
    await saveLog(question, finalReply, apiUsed, elapsed, isViolation ? 1 : 0);

    res.json({
      code: 200,
      data: { reply: finalReply, api: apiUsed, response_time_ms: elapsed, is_violation: isViolation }
    });

  } catch (err) {
    console.error('生成回复失败:', err);
    const elapsed = Date.now() - startTime;
    await saveLog(question, '生成失败: ' + err.message, apiUsed || '未知', elapsed, 0);
    res.json({ code: 500, message: '生成回复失败：' + err.message });
  }
});

async function saveLog(question, reply, apiName, responseTime, isViolation) {
  try {
    await pool.query(
      'INSERT INTO chat_logs (user_question, ai_reply, api_name, response_time_ms, is_violation) VALUES (?,?,?,?,?)',
      [question, reply, apiName, responseTime, isViolation]
    );
  } catch (e) {
    console.error('保存日志失败:', e);
  }
}

// 获取公共AI信息（小程序端获取开场白）
router.get('/public-info', async (req, res) => {
  try {
    const [[settings]] = await pool.query('SELECT default_opening FROM ai_settings LIMIT 1');
    res.json({
      code: 200,
      data: {
        opening: settings?.default_opening || '您好！我是您的专属建站顾问小福😊 请问有什么可以帮您的？'
      }
    });
  } catch (err) {
    res.json({ code: 200, data: { opening: '您好！我是您的专属建站顾问小福😊' } });
  }
});

module.exports = router;
