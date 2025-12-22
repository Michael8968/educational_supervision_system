-- 扩展学前教育普及普惠评估支持
-- 添加幼儿园类型支持和相关字段

-- ============================================================
-- 1. 扩展 schools 表支持幼儿园类型
-- ============================================================

-- 注意：PostgreSQL 不支持直接修改 ENUM 类型的约束
-- school_type 字段的枚举值通过程序层面的 enums.js 验证
-- 需要在 backend/utils/enums.js 中添加 '幼儿园' 到 SCHOOL_TYPES

-- 为 schools 表添加学前教育相关字段
ALTER TABLE schools ADD COLUMN IF NOT EXISTS kindergarten_type TEXT;
-- 幼儿园类型：公办 | 普惠性民办 | 非普惠性民办
-- 枚举值由程序验证

ALTER TABLE schools ADD COLUMN IF NOT EXISTS kindergarten_level TEXT;
-- 幼儿园等级：省级示范 | 市级示范 | 一类 | 二类 | 三类 | 未定级
-- 枚举值由程序验证

ALTER TABLE schools ADD COLUMN IF NOT EXISTS class_count INTEGER DEFAULT 0;
-- 班级数（幼儿园特有）

ALTER TABLE schools ADD COLUMN IF NOT EXISTS small_class_count INTEGER DEFAULT 0;
-- 小班数量

ALTER TABLE schools ADD COLUMN IF NOT EXISTS medium_class_count INTEGER DEFAULT 0;
-- 中班数量

ALTER TABLE schools ADD COLUMN IF NOT EXISTS large_class_count INTEGER DEFAULT 0;
-- 大班数量

ALTER TABLE schools ADD COLUMN IF NOT EXISTS mixed_age_class_count INTEGER DEFAULT 0;
-- 混龄班数量

ALTER TABLE schools ADD COLUMN IF NOT EXISTS area_sqm REAL;
-- 占地面积（平方米）

ALTER TABLE schools ADD COLUMN IF NOT EXISTS outdoor_area_sqm REAL;
-- 户外活动场地面积（平方米）

ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_community_kindergarten BOOLEAN DEFAULT false;
-- 是否为小区配套幼儿园

ALTER TABLE schools ADD COLUMN IF NOT EXISTS community_handover_status TEXT;
-- 小区配套幼儿园移交状态：已移交 | 未移交 | 不适用
-- 枚举值由程序验证

COMMENT ON COLUMN schools.kindergarten_type IS '幼儿园类型：公办 | 普惠性民办 | 非普惠性民办';
COMMENT ON COLUMN schools.kindergarten_level IS '幼儿园等级：省级示范 | 市级示范 | 一类 | 二类 | 三类 | 未定级';
COMMENT ON COLUMN schools.class_count IS '班级总数（幼儿园特有）';
COMMENT ON COLUMN schools.small_class_count IS '小班数量（3-4岁）';
COMMENT ON COLUMN schools.medium_class_count IS '中班数量（4-5岁）';
COMMENT ON COLUMN schools.large_class_count IS '大班数量（5-6岁）';
COMMENT ON COLUMN schools.mixed_age_class_count IS '混龄班数量';
COMMENT ON COLUMN schools.area_sqm IS '占地面积（平方米）';
COMMENT ON COLUMN schools.outdoor_area_sqm IS '户外活动场地面积（平方米）';
COMMENT ON COLUMN schools.is_community_kindergarten IS '是否为小区配套幼儿园';
COMMENT ON COLUMN schools.community_handover_status IS '小区配套幼儿园移交状态：已移交 | 未移交 | 不适用';

-- ============================================================
-- 2. 创建学前教育专用统计视图（可选）
-- ============================================================

-- 区县学前教育概况视图
CREATE OR REPLACE VIEW v_district_preschool_summary AS
SELECT
  d.id AS district_id,
  d.name AS district_name,
  d.code AS district_code,

  -- 幼儿园总数
  COUNT(s.id) AS total_kindergartens,

  -- 公办园统计
  COUNT(CASE WHEN s.kindergarten_type = '公办' THEN 1 END) AS public_kindergartens,
  SUM(CASE WHEN s.kindergarten_type = '公办' THEN s.student_count ELSE 0 END) AS public_students,

  -- 普惠性民办园统计
  COUNT(CASE WHEN s.kindergarten_type = '普惠性民办' THEN 1 END) AS inclusive_private_kindergartens,
  SUM(CASE WHEN s.kindergarten_type = '普惠性民办' THEN s.student_count ELSE 0 END) AS inclusive_private_students,

  -- 非普惠性民办园统计
  COUNT(CASE WHEN s.kindergarten_type = '非普惠性民办' THEN 1 END) AS non_inclusive_private_kindergartens,
  SUM(CASE WHEN s.kindergarten_type = '非普惠性民办' THEN s.student_count ELSE 0 END) AS non_inclusive_private_students,

  -- 总学生数
  SUM(s.student_count) AS total_students,

  -- 班级统计
  SUM(s.class_count) AS total_classes,
  SUM(s.small_class_count) AS total_small_classes,
  SUM(s.medium_class_count) AS total_medium_classes,
  SUM(s.large_class_count) AS total_large_classes,
  SUM(s.mixed_age_class_count) AS total_mixed_age_classes,

  -- 教师统计
  SUM(s.teacher_count) AS total_teachers,

  -- 小区配套幼儿园统计
  COUNT(CASE WHEN s.is_community_kindergarten = true THEN 1 END) AS community_kindergartens,
  COUNT(CASE WHEN s.is_community_kindergarten = true AND s.community_handover_status = '已移交' THEN 1 END) AS handed_over_community_kindergartens,

  -- 城乡分布
  COUNT(CASE WHEN s.urban_rural = '城区' THEN 1 END) AS urban_kindergartens,
  COUNT(CASE WHEN s.urban_rural = '镇区' THEN 1 END) AS town_kindergartens,
  COUNT(CASE WHEN s.urban_rural = '乡村' THEN 1 END) AS rural_kindergartens

FROM districts d
LEFT JOIN schools s ON s.district_id = d.id AND s.school_type = '幼儿园' AND s.status = 'active'
GROUP BY d.id, d.name, d.code;

COMMENT ON VIEW v_district_preschool_summary IS '区县学前教育概况统计视图';

-- ============================================================
-- 3. 创建学前教育指标计算辅助函数（可选）
-- ============================================================

-- 计算公办园在园幼儿占比
CREATE OR REPLACE FUNCTION calc_public_kindergarten_ratio(p_district_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
  v_public_students INTEGER;
  v_total_students INTEGER;
  v_ratio NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN kindergarten_type = '公办' THEN student_count ELSE 0 END), 0),
    COALESCE(SUM(student_count), 0)
  INTO v_public_students, v_total_students
  FROM schools
  WHERE district_id = p_district_id
    AND school_type = '幼儿园'
    AND status = 'active';

  IF v_total_students = 0 THEN
    RETURN 0;
  END IF;

  v_ratio := (v_public_students::NUMERIC / v_total_students::NUMERIC) * 100;
  RETURN ROUND(v_ratio, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calc_public_kindergarten_ratio IS '计算区县公办园在园幼儿占比(%)';

-- 计算普惠性幼儿园覆盖率
CREATE OR REPLACE FUNCTION calc_inclusive_kindergarten_coverage(p_district_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
  v_inclusive_students INTEGER;
  v_total_students INTEGER;
  v_coverage NUMERIC;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN kindergarten_type IN ('公办', '普惠性民办') THEN student_count ELSE 0 END), 0),
    COALESCE(SUM(student_count), 0)
  INTO v_inclusive_students, v_total_students
  FROM schools
  WHERE district_id = p_district_id
    AND school_type = '幼儿园'
    AND status = 'active';

  IF v_total_students = 0 THEN
    RETURN 0;
  END IF;

  v_coverage := (v_inclusive_students::NUMERIC / v_total_students::NUMERIC) * 100;
  RETURN ROUND(v_coverage, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calc_inclusive_kindergarten_coverage IS '计算区县普惠性幼儿园覆盖率(%)';

-- ============================================================
-- 4. 插入示例数据（可选，用于测试）
-- ============================================================

-- 此部分在实际生产环境中应该跳过
-- 仅在开发环境中用于测试

-- 示例：插入几个幼儿园数据（注释掉，按需启用）
/*
INSERT INTO schools (id, code, name, district_id, school_type, school_category, kindergarten_type,
                     kindergarten_level, urban_rural, student_count, teacher_count, class_count,
                     small_class_count, medium_class_count, large_class_count,
                     is_community_kindergarten, community_handover_status, status, created_at, updated_at)
VALUES
  ('kg-001', 'KG001', '市实验幼儿园', 'dist-001', '幼儿园', '公办', '公办',
   '省级示范', '城区', 360, 45, 12, 4, 4, 4, false, '不适用', 'active',
   datetime('now'), datetime('now')),

  ('kg-002', 'KG002', '阳光社区幼儿园', 'dist-001', '幼儿园', '民办', '普惠性民办',
   '一类', '城区', 180, 22, 6, 2, 2, 2, true, '已移交', 'active',
   datetime('now'), datetime('now')),

  ('kg-003', 'KG003', '乡村中心幼儿园', 'dist-001', '幼儿园', '公办', '公办',
   '二类', '乡村', 120, 15, 4, 1, 2, 1, false, '不适用', 'active',
   datetime('now'), datetime('now'));
*/

-- ============================================================
-- 5. 数据完整性检查
-- ============================================================

-- 检查是否有幼儿园未设置 kindergarten_type
SELECT COUNT(*) AS missing_kindergarten_type
FROM schools
WHERE school_type = '幼儿园' AND kindergarten_type IS NULL;

-- 检查是否有小区配套幼儿园未设置移交状态
SELECT COUNT(*) AS missing_handover_status
FROM schools
WHERE school_type = '幼儿园'
  AND is_community_kindergarten = true
  AND (community_handover_status IS NULL OR community_handover_status = '');

-- ============================================================
-- 6. 创建索引优化查询性能
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_schools_school_type ON schools(school_type);
CREATE INDEX IF NOT EXISTS idx_schools_kindergarten_type ON schools(kindergarten_type);
CREATE INDEX IF NOT EXISTS idx_schools_district_school_type ON schools(district_id, school_type);
CREATE INDEX IF NOT EXISTS idx_schools_community_kindergarten ON schools(is_community_kindergarten)
  WHERE school_type = '幼儿园';

-- ============================================================
-- 执行完成
-- ============================================================

-- 显示统计信息
SELECT
  '数据库扩展完成' AS status,
  (SELECT COUNT(*) FROM schools WHERE school_type = '幼儿园') AS total_kindergartens,
  (SELECT COUNT(DISTINCT district_id) FROM schools WHERE school_type = '幼儿园') AS districts_with_kindergartens;
