const express = require('express');
const router = express.Router();

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString().split('T')[0];

// ==================== 项目-采集工具关联 ====================

// 获取项目关联的采集工具列表
router.get('/projects/:projectId/tools', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 检查项目是否存在（程序层面引用验证）
    const projectResult = await db.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (!projectResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    const result = await db.query(`
      SELECT
        pt.id,
        pt.project_id as "projectId",
        pt.tool_id as "toolId",
        pt.sort_order as "sortOrder",
        pt.is_required as "isRequired",
        pt.created_at as "createdAt",
        dt.name as "toolName",
        dt.type as "toolType",
        dt.target as "toolTarget",
        dt.description as "toolDescription",
        dt.status as "toolStatus"
      FROM project_tools pt
      LEFT JOIN data_tools dt ON pt.tool_id = dt.id
      WHERE pt.project_id = $1
      ORDER BY pt.sort_order
    `, [projectId]);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 关联采集工具到项目
router.post('/projects/:projectId/tools', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolId, isRequired = 1 } = req.body;

    if (!toolId) {
      return res.status(400).json({ code: 400, message: '工具ID不能为空' });
    }

    // 检查项目是否存在（程序层面引用验证）
    const projectResult = await db.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (!projectResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    // 检查工具是否存在（程序层面引用验证）
    const toolResult = await db.query('SELECT id FROM data_tools WHERE id = $1', [toolId]);
    if (!toolResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '采集工具不存在' });
    }

    // 检查是否已关联
    const existingResult = await db.query('SELECT id FROM project_tools WHERE project_id = $1 AND tool_id = $2', [projectId, toolId]);
    if (existingResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '该工具已关联到此项目' });
    }

    const id = generateId();
    const timestamp = now();

    // 获取最大排序号
    const { data: maxRows, error: maxErr } = await db
      .from('project_tools')
      .select('sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: false })
      .limit(1);
    if (maxErr) throw maxErr;
    const sortOrder = ((maxRows?.[0]?.sort_order ?? -1) + 1);

    const { data, error } = await db
      .from('project_tools')
      .insert({
        id,
        project_id: projectId,
        tool_id: toolId,
        sort_order: sortOrder,
        is_required: isRequired ? 1 : 0,
        created_at: timestamp,
      })
      .select('id');

    if (error) throw error;
    return res.json({ code: 200, data: { id: data?.[0]?.id || id }, message: '关联成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量关联采集工具到项目
router.post('/projects/:projectId/tools/batch', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolIds } = req.body;

    if (!toolIds || !Array.isArray(toolIds) || toolIds.length === 0) {
      return res.status(400).json({ code: 400, message: '工具ID列表不能为空' });
    }

    // 检查项目是否存在（程序层面引用验证）
    const projectResult = await db.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (!projectResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    const timestamp = now();

    // Data API 不支持多语句事务；原 db.transaction 也非真正事务，这里改为逐条写入
    const { data: maxRows, error: maxErr } = await db
      .from('project_tools')
      .select('sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: false })
      .limit(1);
    if (maxErr) throw maxErr;
    let sortOrder = ((maxRows?.[0]?.sort_order ?? -1) + 1);

    for (const toolId of toolIds) {
      // 检查是否已关联
      const { data: existing, error: existErr } = await db
        .from('project_tools')
        .select('id')
        .eq('project_id', projectId)
        .eq('tool_id', toolId)
        .maybeSingle();
      if (existErr) throw existErr;
      if (existing) continue;

      const id = generateId();
      const { error: insErr } = await db
        .from('project_tools')
        .insert({
          id,
          project_id: projectId,
          tool_id: toolId,
          sort_order: sortOrder++,
          is_required: 1,
          created_at: timestamp,
        });
      if (insErr) throw insErr;
    }

    return res.json({ code: 200, message: '批量关联成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 移除项目与工具的关联
router.delete('/projects/:projectId/tools/:toolId', async (req, res) => {
  try {
    const { projectId, toolId } = req.params;

    const { data, error } = await db
      .from('project_tools')
      .delete()
      .eq('project_id', projectId)
      .eq('tool_id', toolId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '关联关系不存在' });
    }

    return res.json({ code: 200, message: '移除成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新关联属性（是否必填）
router.put('/projects/:projectId/tools/:toolId', async (req, res) => {
  try {
    const { projectId, toolId } = req.params;
    const { isRequired } = req.body;

    const { data, error } = await db
      .from('project_tools')
      .update({ is_required: isRequired ? 1 : 0 })
      .eq('project_id', projectId)
      .eq('tool_id', toolId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '关联关系不存在' });
    }

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 调整工具排序
router.put('/projects/:projectId/tools/order', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolIds } = req.body;

    if (!toolIds || !Array.isArray(toolIds)) {
      return res.status(400).json({ code: 400, message: '工具ID列表格式错误' });
    }

    for (let index = 0; index < toolIds.length; index++) {
      const toolId = toolIds[index];
      const { data, error } = await db
        .from('project_tools')
        .update({ sort_order: index })
        .eq('project_id', projectId)
        .eq('tool_id', toolId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ code: 404, message: '关联关系不存在' });
      }
    }

    return res.json({ code: 200, message: '排序更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取项目可用的采集工具（未关联的已发布工具）
router.get('/projects/:projectId/available-tools', async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(`
      SELECT id, name, type, target, description, status,
             created_by as "createdBy", created_at as "createdAt"
      FROM data_tools
      WHERE status = 'published'
        AND id NOT IN (SELECT tool_id FROM project_tools WHERE project_id = $1)
      ORDER BY created_at DESC
    `, [projectId]);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
