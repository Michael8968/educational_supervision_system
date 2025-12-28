-- =====================================================
-- 评估专家功能重构 - 数据库迁移脚本
-- 版本: 001
-- 日期: 2025-01-28
-- 数据库: PostgreSQL (Supabase)
-- 说明:
--   1. 标记旧的审核任务分配表为废弃
--   2. 创建新的评估相关表
--   3. 审核功能转移给项目管理员（使用现有的submissions表状态）
-- =====================================================

-- =====================================================
-- 第一部分：标记旧表为废弃（暂不删除，保留数据）
-- =====================================================

-- 为 review_assignments 表添加注释说明其已废弃（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'review_assignments') THEN
    COMMENT ON TABLE review_assignments IS '@deprecated 此表已废弃。审核功能已转移给项目管理员，直接使用submissions表的status字段。将在后续版本中删除。';
  END IF;
END $$;

-- 为 reviewer_scopes 表添加注释说明其已废弃（如果表存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviewer_scopes') THEN
    COMMENT ON TABLE reviewer_scopes IS '@deprecated 此表已废弃。评估专家审核范围功能已移除。将在后续版本中删除。';
  END IF;
END $$;

-- =====================================================
-- 第二部分：移除 tasks 表中的审核相关字段（可选）
-- =====================================================

-- 注意：这些字段保留不删除，因为审核功能仍在使用，只是由项目管理员执行
-- 如果确定要移除，取消下面的注释

-- ALTER TABLE tasks DROP COLUMN IF EXISTS requires_review;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS reviewer_id;

-- =====================================================
-- 第三部分：创建新的评估相关表
-- =====================================================

-- 1. 评估任务分配表
CREATE TABLE IF NOT EXISTS expert_assignments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  expert_id TEXT NOT NULL,                -- project_personnel.id (role='project_expert')

  -- 评估对象（学校或区县）
  target_type TEXT NOT NULL,              -- 'school' | 'district'
  target_id TEXT NOT NULL,                -- project_samples.id

  -- 评估范围
  indicator_scope TEXT DEFAULT 'all',     -- 'all' | 'partial'

  -- 状态与时间
  status TEXT DEFAULT 'pending',          -- pending | in_progress | completed | submitted
  assigned_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  due_date TEXT,

  -- 元数据
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  UNIQUE(project_id, expert_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_expert_assignments_expert ON expert_assignments(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_assignments_target ON expert_assignments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_expert_assignments_status ON expert_assignments(status);
CREATE INDEX IF NOT EXISTS idx_expert_assignments_project ON expert_assignments(project_id);

COMMENT ON TABLE expert_assignments IS '评估任务分配表：项目管理员分配给专家的评估任务';

-- 2. 指标评分表
CREATE TABLE IF NOT EXISTS indicator_scores (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,            -- expert_assignments.id
  project_id TEXT NOT NULL,
  expert_id TEXT NOT NULL,
  target_id TEXT NOT NULL,

  -- 指标信息
  indicator_id TEXT NOT NULL,             -- indicators.id
  indicator_code TEXT,                    -- 冗余存储便于查询

  -- 评分结果
  score REAL,                             -- 评分值
  score_level TEXT,                       -- 等级：A/B/C/D
  is_compliant BOOLEAN,                   -- 是否达标

  -- 评分依据
  score_basis TEXT,                       -- 评分依据说明
  data_reference TEXT,                    -- 数据快照（JSON）

  -- 时间戳
  scored_at TEXT,
  updated_at TEXT,

  UNIQUE(assignment_id, indicator_id)
);

CREATE INDEX IF NOT EXISTS idx_indicator_scores_assignment ON indicator_scores(assignment_id);
CREATE INDEX IF NOT EXISTS idx_indicator_scores_indicator ON indicator_scores(indicator_id);
CREATE INDEX IF NOT EXISTS idx_indicator_scores_target ON indicator_scores(target_id);

COMMENT ON TABLE indicator_scores IS '指标评分表：专家对每个指标的评分记录';

-- 3. 评估评语表
CREATE TABLE IF NOT EXISTS evaluation_comments (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  expert_id TEXT NOT NULL,
  target_id TEXT NOT NULL,

  -- 评价类型
  comment_type TEXT NOT NULL,             -- 'strength' | 'weakness' | 'suggestion' | 'highlight' | 'overall'

  -- 评价内容
  content TEXT NOT NULL,
  related_indicators TEXT,                -- JSON数组
  priority INTEGER DEFAULT 0,

  -- 时间戳
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_evaluation_comments_assignment ON evaluation_comments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_comments_type ON evaluation_comments(comment_type);

COMMENT ON TABLE evaluation_comments IS '评估评语表：专家对评估对象的定性评价';

-- 4. 评估结论表
CREATE TABLE IF NOT EXISTS evaluation_results (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  expert_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,

  -- 评估结论
  overall_score REAL,                     -- 综合得分
  overall_level TEXT,                     -- 综合等级
  is_compliant BOOLEAN,                   -- 整体是否达标
  compliance_rate REAL,                   -- 达标率

  -- 评估摘要
  summary TEXT,                           -- 总体评价摘要
  main_strengths TEXT,                    -- JSON数组
  main_weaknesses TEXT,                   -- JSON数组
  key_suggestions TEXT,                   -- JSON数组

  -- 状态
  status TEXT DEFAULT 'draft',            -- draft | submitted | confirmed
  submitted_at TEXT,
  confirmed_at TEXT,
  confirmed_by TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_evaluation_results_target ON evaluation_results(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_project ON evaluation_results(project_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_status ON evaluation_results(status);

COMMENT ON TABLE evaluation_results IS '评估结论表：评估最终结论';

-- 5. 问题台账表
CREATE TABLE IF NOT EXISTS issue_registry (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,

  -- 问题信息
  issue_code TEXT,                        -- 自动生成的编号
  title TEXT NOT NULL,
  description TEXT,
  related_indicators TEXT,                -- JSON数组
  severity TEXT DEFAULT 'medium',         -- high | medium | low

  -- 发现信息
  found_by TEXT NOT NULL,                 -- expert_id
  found_at TEXT,
  evaluation_id TEXT,

  -- 整改要求
  rectification_required BOOLEAN DEFAULT true,
  rectification_deadline TEXT,
  rectification_suggestion TEXT,

  -- 整改状态
  status TEXT DEFAULT 'open',             -- open | rectifying | resolved | closed | waived
  rectified_at TEXT,
  rectification_evidence TEXT,            -- JSON

  -- 复评信息
  review_status TEXT,                     -- pending_review | reviewed
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_result TEXT,                     -- passed | failed
  review_comment TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_issue_registry_target ON issue_registry(target_id);
CREATE INDEX IF NOT EXISTS idx_issue_registry_status ON issue_registry(status);
CREATE INDEX IF NOT EXISTS idx_issue_registry_project ON issue_registry(project_id);
CREATE INDEX IF NOT EXISTS idx_issue_registry_severity ON issue_registry(severity);

COMMENT ON TABLE issue_registry IS '问题台账表：评估发现的问题跟踪';

-- 6. 评分标准表
CREATE TABLE IF NOT EXISTS scoring_standards (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  indicator_id TEXT NOT NULL,

  -- 评分方式
  scoring_type TEXT NOT NULL,             -- 'numeric' | 'level' | 'binary'

  -- 数值型配置
  max_score REAL DEFAULT 100,
  min_score REAL DEFAULT 0,
  pass_score REAL,

  -- 等级型配置
  levels TEXT,                            -- JSON

  -- 评分指南
  scoring_guide TEXT,
  reference_materials TEXT,               -- JSON数组

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  UNIQUE(project_id, indicator_id)
);

CREATE INDEX IF NOT EXISTS idx_scoring_standards_project ON scoring_standards(project_id);
CREATE INDEX IF NOT EXISTS idx_scoring_standards_indicator ON scoring_standards(indicator_id);

COMMENT ON TABLE scoring_standards IS '评分标准表：指标评分标准配置';

-- =====================================================
-- 第四部分：创建视图（多专家评分汇总）
-- =====================================================

-- 使用 CREATE OR REPLACE VIEW（PostgreSQL 语法）
CREATE OR REPLACE VIEW expert_score_summary AS
SELECT
  project_id,
  target_id,
  indicator_id,
  COUNT(DISTINCT expert_id) as expert_count,
  AVG(score) as avg_score,
  MIN(score) as min_score,
  MAX(score) as max_score,
  MAX(score) - MIN(score) as score_variance,
  SUM(CASE WHEN is_compliant THEN 1 ELSE 0 END) as compliant_count,
  CASE WHEN SUM(CASE WHEN is_compliant THEN 1 ELSE 0 END) > COUNT(*)/2
       THEN 1 ELSE 0 END as majority_compliant
FROM indicator_scores
GROUP BY project_id, target_id, indicator_id;

-- =====================================================
-- 迁移完成
-- =====================================================
