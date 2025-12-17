-- 修复：缺失 tasks 表
-- 用途：/api/projects/:projectId/tasks* 相关接口依赖 tasks 表
-- 说明：请在 Supabase SQL Editor 中执行本脚本

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,          -- 关联 projects.id（由程序验证）
  tool_id TEXT NOT NULL,             -- 关联 data_tools.id（由程序验证）
  assignee_id TEXT NOT NULL,         -- 关联 project_personnel.id（由程序验证）
  target_type TEXT,                  -- 可选：任务指向对象类型
  target_id TEXT,                    -- 可选：任务指向对象ID
  due_date TEXT,                     -- 可选：截止日期/时间（ISO 字符串）
  status TEXT DEFAULT 'pending',
  submission_id TEXT,               -- 可选：关联 submissions.id
  completed_at TEXT,                -- 可选：完成时间（ISO 字符串）
  created_at TEXT,
  updated_at TEXT
);

-- 同一项目/工具/执行人默认只允许一条任务（与后端逻辑一致）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_unique_project_tool_assignee'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_unique_project_tool_assignee UNIQUE (project_id, tool_id, assignee_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tool ON tasks(tool_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);


