-- ==========================================
-- 数据库索引优化脚本（既有数据库升级用）
-- ==========================================
-- 执行方式: mysql -u root -p wfr < database_add_indexes.sql
-- 说明：脚本会检测索引是否已存在，重复执行不会报错。

USE wfr;

DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER //
CREATE PROCEDURE add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_columns VARCHAR(500)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table_name
      AND index_name = p_index_name
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table_name, '` ADD INDEX `', p_index_name, '` (', p_columns, ')');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

-- 对话日志：按时间范围和风控状态统计/筛选
CALL add_index_if_missing('chat_logs', 'idx_chat_logs_created', '`created_at`');
CALL add_index_if_missing('chat_logs', 'idx_created_violation', '`created_at`, `is_violation`');

-- 产品库：按上架状态和分类筛选
CALL add_index_if_missing('products', 'idx_products_active', '`is_active`');
CALL add_index_if_missing('products', 'idx_active_category', '`is_active`, `category_id`');

-- API配置：快速查找主接口和启用接口
CALL add_index_if_missing('api_configs', 'idx_api_configs_primary', '`is_primary`');
CALL add_index_if_missing('api_configs', 'idx_primary_active', '`is_primary`, `is_active`');

-- AI记忆：按会话读取上下文
CALL add_index_if_missing('ai_memories', 'idx_session_created', '`session_id`, `created_at`');

-- 违禁词：按启用状态读取
CALL add_index_if_missing('banned_words', 'idx_banned_words_active', '`is_active`');
CALL add_index_if_missing('banned_words', 'idx_active_category', '`is_active`, `category`');

DROP PROCEDURE add_index_if_missing;

-- 显示本库索引，便于确认
SELECT
  TABLE_NAME,
  INDEX_NAME,
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
GROUP BY TABLE_NAME, INDEX_NAME
ORDER BY TABLE_NAME, INDEX_NAME;
