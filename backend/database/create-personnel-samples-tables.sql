-- ============================================
-- 人员管理和样本管理表结构
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- ==================== 项目人员表 ====================
CREATE TABLE IF NOT EXISTS project_personnel (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  organization TEXT,
  phone TEXT,
  id_card TEXT,
  role TEXT NOT NULL,  -- 'leader' | 'member' | 'expert' | 'observer'
  status TEXT DEFAULT 'active',  -- 'active' | 'inactive'
  created_at TEXT,
  updated_at TEXT,
  CONSTRAINT fk_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_project_personnel_project ON project_personnel(project_id);
CREATE INDEX IF NOT EXISTS idx_project_personnel_role ON project_personnel(role);

-- ==================== 项目样本配置表 ====================
CREATE TABLE IF NOT EXISTS project_sample_config (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  district BOOLEAN DEFAULT true,
  school BOOLEAN DEFAULT true,
  grade BOOLEAN DEFAULT false,
  class BOOLEAN DEFAULT false,
  student BOOLEAN DEFAULT false,
  parent BOOLEAN DEFAULT false,
  department BOOLEAN DEFAULT false,
  teacher BOOLEAN DEFAULT true,
  created_at TEXT,
  updated_at TEXT,
  CONSTRAINT fk_project_config FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ==================== 项目样本数据表 ====================
CREATE TABLE IF NOT EXISTS project_samples (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_id TEXT,  -- 父级样本ID（如学校的父级是区县）
  type TEXT NOT NULL,  -- 'district' | 'school' | 'teacher' | 'grade' | 'class' | 'student'
  code TEXT,  -- 样本编码
  name TEXT NOT NULL,
  -- 区县特有字段
  -- 学校特有字段
  school_type TEXT,  -- 学校类型
  teacher_sample_mode TEXT,  -- 'self' | 'assigned' 教师填报方式
  -- 教师/学生特有字段
  phone TEXT,
  id_card TEXT,
  -- 通用字段
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT,
  updated_at TEXT,
  CONSTRAINT fk_project_sample FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_project_samples_project ON project_samples(project_id);
CREATE INDEX IF NOT EXISTS idx_project_samples_parent ON project_samples(parent_id);
CREATE INDEX IF NOT EXISTS idx_project_samples_type ON project_samples(type);

-- 复合唯一索引（同一项目下同类型样本名称唯一）
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_samples_unique
  ON project_samples(project_id, type, parent_id, name)
  WHERE parent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_samples_unique_root
  ON project_samples(project_id, type, name)
  WHERE parent_id IS NULL;

-- ============================================
-- 执行完成提示
-- ============================================
SELECT '人员和样本管理表创建完成！' as message;
