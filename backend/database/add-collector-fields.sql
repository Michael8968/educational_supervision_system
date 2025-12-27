-- ============================================
-- 为 project_samples 表添加数据采集员字段
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 添加数据采集员ID字段
ALTER TABLE project_samples ADD COLUMN IF NOT EXISTS collector_id TEXT;

-- 添加数据采集员姓名字段
ALTER TABLE project_samples ADD COLUMN IF NOT EXISTS collector_name TEXT;

-- 添加数据采集员电话字段
ALTER TABLE project_samples ADD COLUMN IF NOT EXISTS collector_phone TEXT;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_project_samples_collector ON project_samples(collector_id);

-- ============================================
-- 执行完成提示
-- ============================================
SELECT '数据采集员字段添加完成！' as message;
