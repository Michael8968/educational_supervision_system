-- ============================================
-- 修复 elements 表缺失 aggregation 列的 SQL 脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 添加 aggregation 列（如果不存在）
ALTER TABLE elements ADD COLUMN IF NOT EXISTS aggregation JSONB;

-- 刷新 PostgREST schema cache（Supabase API 需要重载才能识别新列）
NOTIFY pgrst, 'reload schema';

SELECT 'aggregation 列修复完成！' as message;

