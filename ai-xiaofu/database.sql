-- ========================================
-- AI小福 建站接单客服助手 数据库
-- 数据库名称: wfr
-- ========================================

CREATE DATABASE IF NOT EXISTS wfr DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wfr;

-- 管理员表（仅密码登录，无用户名）
CREATE TABLE IF NOT EXISTS admin (
  id INT PRIMARY KEY AUTO_INCREMENT,
  password VARCHAR(255) NOT NULL COMMENT 'bcrypt加密密码',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 初始密码: zyh123456 (bcrypt)
INSERT INTO admin (password) VALUES ('$2a$10$OZtRoR5svU3JYeS2aIPVmOqgISo5T5f8lQaAnzyf30zdLKnp5W29a');

-- AI全局自定义设置表
CREATE TABLE IF NOT EXISTS ai_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  personality TEXT COMMENT 'AI性格描述',
  reply_max_length INT DEFAULT 500 COMMENT '回复字数限制',
  reply_in_paragraphs TINYINT DEFAULT 1 COMMENT '是否分段回复',
  proactive_follow_up TINYINT DEFAULT 1 COMMENT '是否主动追问客户',
  ban_internet_slang TINYINT DEFAULT 1 COMMENT '禁止网络流行语',
  ban_marketing_words TINYINT DEFAULT 1 COMMENT '禁止营销违禁词',
  reply_tone VARCHAR(50) DEFAULT '专业温和' COMMENT '回复语气',
  memory_enabled TINYINT DEFAULT 1 COMMENT '开启上下文记忆',
  memory_retention_days INT DEFAULT 30 COMMENT '记忆保存天数',
  default_opening TEXT COMMENT '默认开场白',
  fallback_reply TEXT COMMENT '兜底回复',
  custom_system_prompt TEXT COMMENT '自定义系统提示词',
  chat_mode VARCHAR(50) DEFAULT 'friend' COMMENT '聊天形态：friend(朋友)/bestie(闺蜜)/brother(兄弟)/lover(恋人)',
  ai_temperature DECIMAL(3,2) DEFAULT 0.7 COMMENT 'AI回复随机性(0.0-2.0)',
  ai_interests TEXT COMMENT 'AI兴趣爱好(JSON格式)',
  enable_human_mode TINYINT DEFAULT 0 COMMENT '是否启用真人模式',
  human_mode_tip TEXT COMMENT '真人模式提示语',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO ai_settings (personality, reply_max_length, reply_in_paragraphs, proactive_follow_up, ban_internet_slang, ban_marketing_words, reply_tone, memory_enabled, memory_retention_days, default_opening, fallback_reply)
VALUES (
  '你是一个专业耐心的建站客服，精通网站建设、小程序开发、服务器配置等技术服务。你的回答专业准确、报价合理透明、态度温和有礼。',
  500, 1, 1, 1, 1, '专业温和', 1, 30,
  '您好！我是您的专属建站顾问小福😊 请问有什么可以帮您的？无论是建站咨询、报价了解还是技术问题，我都可以为您详细解答~',
  '您好，您的问题我需要进一步了解才能给您准确答复。方便的话可以详细描述一下您的需求，比如您想做什么类型的网站、预算大概多少呢？我会根据您的需求为您推荐最合适的方案~'
);

-- 产品分类表
CREATE TABLE IF NOT EXISTS product_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL COMMENT '分类名称',
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO product_categories (name, sort_order) VALUES
('企业官网搭建', 1), ('个人博客建站', 2), ('商城网站', 3),
('小程序开发', 4), ('源码部署', 5), ('网站改版', 6),
('服务器配置', 7), ('域名备案', 8), ('网站维护', 9);

-- 产品库表
CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT,
  name VARCHAR(200) NOT NULL COMMENT '产品名称',
  description TEXT COMMENT '详细服务介绍',
  standard_price DECIMAL(10,2) COMMENT '标准售价',
  discount_price DECIMAL(10,2) COMMENT '优惠价',
  included_services TEXT COMMENT '包含服务项',
  excluded_services TEXT COMMENT '不包含服务项',
  faq TEXT COMMENT '常见问题标准答案（JSON格式）',
  delivery_days VARCHAR(50) COMMENT '交付周期',
  after_sales VARCHAR(200) COMMENT '售后保障',
  is_active TINYINT DEFAULT 1 COMMENT '启用开关',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- API接口管理表
CREATE TABLE IF NOT EXISTS api_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL COMMENT '接口名称',
  api_type VARCHAR(50) DEFAULT 'deepseek' COMMENT '接口类型',
  api_key VARCHAR(500) NOT NULL COMMENT 'API密钥',
  api_url VARCHAR(300) NOT NULL COMMENT '接口地址',
  model VARCHAR(100) NOT NULL COMMENT '模型版本',
  temperature DECIMAL(3,2) DEFAULT 0.7 COMMENT '温度值',
  max_tokens INT DEFAULT 2000 COMMENT '最大生成长度',
  timeout_seconds INT DEFAULT 30 COMMENT '超时时间(秒)',
  is_primary TINYINT DEFAULT 0 COMMENT '是否主接口',
  is_active TINYINT DEFAULT 1 COMMENT '是否启用',
  weight INT DEFAULT 1 COMMENT '权重',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 默认DeepSeek API配置
-- 注意：首次部署后请在管理后台添加真实的API配置，或通过以下SQL手动插入：
-- INSERT INTO api_configs (name, api_type, api_key, api_url, model, temperature, max_tokens, timeout_seconds, is_primary, is_active, weight)
-- VALUES ('DeepSeek主接口', 'deepseek', 'your_api_key_here', 'https://api.deepseek.com/v1/chat/completions', 'deepseek-chat', 0.7, 2000, 30, 1, 1, 10);

-- 对话日志表
CREATE TABLE IF NOT EXISTS chat_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_question TEXT COMMENT '客户原话',
  ai_reply TEXT COMMENT 'AI回复内容',
  api_name VARCHAR(100) COMMENT '调用的API名称',
  response_time_ms INT COMMENT '回复耗时(毫秒)',
  is_violation TINYINT DEFAULT 0 COMMENT '是否触发风控',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 违禁词库表
CREATE TABLE IF NOT EXISTS banned_words (
  id INT PRIMARY KEY AUTO_INCREMENT,
  word VARCHAR(200) NOT NULL COMMENT '违禁词/短语',
  category VARCHAR(50) DEFAULT '通用' COMMENT '分类',
  is_regex TINYINT DEFAULT 0 COMMENT '是否正则表达式',
  is_active TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO banned_words (word, category) VALUES
('微信', '联系方式'), ('微信号', '联系方式'), ('VX', '联系方式'), ('vx', '联系方式'),
('QQ', '联系方式'), ('qq', '联系方式'), ('手机号', '联系方式'), ('电话', '联系方式'),
('加我', '站外引流'), ('私聊', '站外引流'), ('线下', '私下交易'), ('面交', '私下交易'),
('支付宝', '私下交易'), ('转账', '私下交易'), ('红包', '私下交易'),
('点击链接', '站外引流'), ('下载APP', '站外引流'), ('扫码', '站外引流'),
('免费送', '营销违禁'), ('最低价', '营销违禁'), ('绝对', '营销违禁');

-- AI上下文记忆表
CREATE TABLE IF NOT EXISTS ai_memories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id VARCHAR(100) NOT NULL COMMENT '会话标识',
  role ENUM('user','assistant') NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session (session_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==================== 索引优化 ====================

-- 对话日志索引（按时间和风控状态查询）
CREATE INDEX IF NOT EXISTS idx_chat_logs_created ON chat_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_violation ON chat_logs(created_at, is_violation);

-- 产品索引（按状态和分类查询）
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_active_category ON products(is_active, category_id);

-- API配置索引（按主API和启用状态查询）
CREATE INDEX IF NOT EXISTS idx_api_configs_primary ON api_configs(is_primary);
CREATE INDEX IF NOT EXISTS idx_api_configs_primary_active ON api_configs(is_primary, is_active);

-- AI记忆索引（按会话和时间查询，最重要的优化）
CREATE INDEX IF NOT EXISTS idx_ai_memories_session ON ai_memories(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_memories_session_created ON ai_memories(session_id, created_at);

-- 违禁词索引（按启用状态查询）
CREATE INDEX IF NOT EXISTS idx_banned_words_active ON banned_words(is_active);
CREATE INDEX IF NOT EXISTS idx_banned_words_active_category ON banned_words(is_active, category);
