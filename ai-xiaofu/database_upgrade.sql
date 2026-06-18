-- ========================================
-- AI小福 数据库升级脚本
-- 用于已有数据库添加新功能字段
-- ========================================

USE wfr;

-- 为ai_settings表添加新字段
ALTER TABLE ai_settings
ADD COLUMN chat_mode VARCHAR(50) DEFAULT 'friend' COMMENT '聊天形态：daily(日常)/friend(朋友)/bestie(闺蜜)/brother(兄弟)/lover(恋人)' AFTER custom_system_prompt,
ADD COLUMN ai_temperature DECIMAL(3,2) DEFAULT 0.7 COMMENT 'AI回复随机性(0.0-2.0)' AFTER chat_mode,
ADD COLUMN ai_interests TEXT COMMENT 'AI兴趣爱好(JSON格式)' AFTER ai_temperature,
ADD COLUMN enable_human_mode TINYINT DEFAULT 0 COMMENT '是否启用真人模式' AFTER ai_interests,
ADD COLUMN human_mode_tip TEXT COMMENT '真人模式提示语' AFTER enable_human_mode;

-- 更新现有数据的默认值
UPDATE ai_settings SET
  chat_mode = 'friend',
  ai_temperature = 0.7,
  ai_interests = '{"爱吃":"奶茶、火锅、甜品","爱玩":"看电影、听音乐、散步","爱看":"悬疑小说、治愈系动漫","性格":"温柔体贴、善解人意、乐观开朗"}',
  enable_human_mode = 1,
  human_mode_tip = '小福正在用心回复你~'
WHERE id = 1;

SELECT '数据库升级完成！' AS message;
