-- 为 project_data_tools 表添加 source_tool_id 列
-- 用于追踪项目采集工具副本的来源模板ID，便于同步删除

ALTER TABLE project_data_tools
ADD COLUMN IF NOT EXISTS source_tool_id TEXT;

-- 创建索引以加速按来源工具ID查询
CREATE INDEX IF NOT EXISTS idx_project_data_tools_source_tool
ON project_data_tools(source_tool_id);

-- 尝试根据名称匹配更新现有记录的 source_tool_id
-- 注意：这是一个尽力而为的匹配，可能不完全准确
UPDATE project_data_tools pdt
SET source_tool_id = (
  SELECT dt.id FROM data_tools dt
  WHERE dt.name = pdt.name
  LIMIT 1
)
WHERE pdt.source_tool_id IS NULL;

-- 通知 PostgREST 刷新 schema cache
NOTIFY pgrst, 'reload schema';
