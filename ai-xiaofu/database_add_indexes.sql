-- ==========================================
-- 数据库索引优化脚本
-- ==========================================
-- 执行方式: mysql -u root -p wfr < add_indexes.sql

USE wfr;

-- 1. ai_memories 表索引优化
-- 用途：加速按会话ID和时间查询对话历史
ALTER TABLE ai_memories
ADD INDEX idx_session_created (session_id, created_at);

-- 2. chat_logs 表索引优化
-- 用途：加速按日期范围查询日志
ALTER TABLE chat_logs
ADD INDEX idx_created_violation (created_at, is_violation);

-- 3. products 表复合索引
-- 用途：加速按分类和状态查询产品
ALTER TABLE products
ADD INDEX idx_active_category (is_active, category_id);

-- 4. banned_words 表索引
-- 用途：加速启用状态的违禁词查询
ALTER TABLE banned_words
ADD INDEX idx_active_category (is_active, category);

-- 5. api_configs 表索引
-- 用途：加速查找主API和启用API
ALTER TABLE api_configs
ADD INDEX idx_primary_active (is_primary, is_active);

-- 显示所有表的索引
SELECT
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'wfr'
GROUP BY TABLE_NAME, INDEX_NAME
ORDER BY TABLE_NAME, INDEX_NAME;
