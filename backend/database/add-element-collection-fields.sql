-- 为 elements 表添加采集来源相关字段
-- 执行此脚本以支持 collectionLevel、calculationLevel 和 dataSource 字段

-- 添加 collection_level 字段（采集来源级别）
ALTER TABLE elements ADD COLUMN IF NOT EXISTS collection_level TEXT;

-- 添加 calculation_level 字段（计算级别）
ALTER TABLE elements ADD COLUMN IF NOT EXISTS calculation_level TEXT;

-- 添加 data_source 字段（数据来源说明）
ALTER TABLE elements ADD COLUMN IF NOT EXISTS data_source TEXT;

-- 刷新 PostgREST schema cache（如果使用 Supabase）
NOTIFY pgrst, 'reload schema';

-- 验证字段是否添加成功
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'elements' 
  AND column_name IN ('collection_level', 'calculation_level', 'data_source')
ORDER BY column_name;

