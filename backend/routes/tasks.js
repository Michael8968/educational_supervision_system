const express = require('express');
const router = express.Router();

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// ==================== 项目任务 CRUD ====================

// 获取项目任务列表
router.get('/projects/:projectId/tasks', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolId, assigneeId, status } = req.query;

    let sql = `
      SELECT
        t.id,
        t.project_id as "projectId",
        t.tool_id as "toolId",
        t.assignee_id as "assigneeId",
        t.target_type as "targetType",
        t.target_id as "targetId",
        t.status,
        t.due_date as "dueDate",
        t.submission_id as "submissionId",
        t.completed_at as "completedAt",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        dt.name as "toolName",
        dt.type as "toolType",
        pp.name as "assigneeName",
        pp.organization as "assigneeOrg"
      FROM tasks t
      LEFT JOIN data_tools dt ON t.tool_id = dt.id
      LEFT JOIN project_personnel pp ON t.assignee_id = pp.id
      WHERE t.project_id = $1
    `;
    const params = [projectId];
    let paramIndex = 2;

    if (toolId) {
      sql += ` AND t.tool_id = $${paramIndex++}`;
      params.push(toolId);
    }
    if (assigneeId) {
      sql += ` AND t.assignee_id = $${paramIndex++}`;
      params.push(assigneeId);
    }
    if (status) {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' ORDER BY t.created_at DESC';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 获取任务统计
router.get('/projects/:projectId/tasks/stats', async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as "inProgress",
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue
      FROM tasks
      WHERE project_id = $1
    `, [projectId]);

    const stats = result.rows[0];
    const total = parseInt(stats.total) || 0;
    const completed = parseInt(stats.completed) || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      code: 200,
      data: {
        total,
        pending: parseInt(stats.pending) || 0,
        inProgress: parseInt(stats.inProgress) || 0,
        completed,
        overdue: parseInt(stats.overdue) || 0,
        completionRate,
      },
    });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 获取单个任务
router.get('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        t.id,
        t.project_id as "projectId",
        t.tool_id as "toolId",
        t.assignee_id as "assigneeId",
        t.target_type as "targetType",
        t.target_id as "targetId",
        t.status,
        t.due_date as "dueDate",
        t.submission_id as "submissionId",
        t.completed_at as "completedAt",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        dt.name as "toolName",
        dt.type as "toolType",
        pp.name as "assigneeName",
        pp.organization as "assigneeOrg"
      FROM tasks t
      LEFT JOIN data_tools dt ON t.tool_id = dt.id
      LEFT JOIN project_personnel pp ON t.assignee_id = pp.id
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({ code: 200, data: result.rows[0] });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 创建单个任务
router.post('/projects/:projectId/tasks', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolId, assigneeId, targetType, targetId, dueDate } = req.body;

    if (!toolId || !assigneeId) {
      return res.status(400).json({ code: 400, message: '工具ID和采集员ID为必填项' });
    }

    const id = generateId();
    const timestamp = now();

    // 使用 Supabase Data API，避免 exec_sql 仅支持 SELECT 的限制
    const { data, error } = await db
      .from('tasks')
      .insert({
        id,
        project_id: projectId,
        tool_id: toolId,
        assignee_id: assigneeId,
        target_type: targetType || null,
        target_id: targetId || null,
        due_date: dueDate || null,
        status: 'pending',
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('id');

    if (error) throw error;

    const createdId = data?.[0]?.id || id;
    res.json({ code: 200, data: { id: createdId }, message: '任务创建成功' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 批量创建任务
router.post('/projects/:projectId/tasks/batch', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolId, assigneeIds, targetType, targetIds, dueDate } = req.body;

    if (!toolId || !assigneeIds || assigneeIds.length === 0) {
      return res.status(400).json({ code: 400, message: '工具ID和采集员ID列表为必填项' });
    }

    const timestamp = now();

    // 使用 Supabase Data API：先批量查询已存在任务，再批量插入缺失任务
    const { data: existing, error: existingError } = await db
      .from('tasks')
      .select('assignee_id')
      .eq('project_id', projectId)
      .eq('tool_id', toolId)
      .in('assignee_id', assigneeIds);
    if (existingError) throw existingError;

    const existingSet = new Set((existing || []).map(r => r.assignee_id));
    const toCreate = assigneeIds
      .filter(aid => !existingSet.has(aid))
      .map((assigneeId) => ({
        id: generateId(),
        project_id: projectId,
        tool_id: toolId,
        assignee_id: assigneeId,
        target_type: targetType || null,
        target_id: targetIds?.[0] || null,
        due_date: dueDate || null,
        status: 'pending',
        created_at: timestamp,
        updated_at: timestamp,
      }));

    if (toCreate.length === 0) {
      return res.json({ code: 200, data: { created: 0 }, message: '成功创建 0 个任务' });
    }

    const { data: inserted, error: insertError } = await db
      .from('tasks')
      .insert(toCreate)
      .select('id');
    if (insertError) throw insertError;

    const createdCount = inserted?.length || toCreate.length;
    res.json({ code: 200, data: { created: createdCount }, message: `成功创建 ${createdCount} 个任务` });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 更新任务
router.put('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, dueDate, assigneeId } = req.body;

    // 使用 Supabase Data API，避免 exec_sql 仅支持 SELECT 的限制
    if (status === undefined && dueDate === undefined && assigneeId === undefined) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' });
    }

    const updates = {
      ...(status !== undefined ? { status } : {}),
      ...(dueDate !== undefined ? { due_date: dueDate } : {}),
      ...(assigneeId !== undefined ? { assignee_id: assigneeId } : {}),
      updated_at: now(),
    };

    const { data, error } = await db
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 删除任务
router.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await db
      .from('tasks')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 批量删除任务
router.post('/tasks/batch-delete', async (req, res) => {
  try {
    const { taskIds } = req.body;

    if (!taskIds || taskIds.length === 0) {
      return res.status(400).json({ code: 400, message: '任务ID列表不能为空' });
    }

    const { data, error } = await db
      .from('tasks')
      .delete()
      .in('id', taskIds)
      .select('id');
    if (error) throw error;

    const deleted = data?.length || 0;
    res.json({ code: 200, data: { deleted }, message: `成功删除 ${deleted} 个任务` });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 开始任务
router.post('/tasks/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await db
      .from('tasks')
      .update({ status: 'in_progress', updated_at: now() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(400).json({ code: 400, message: '任务不存在或状态不允许开始' });
    }

    res.json({ code: 200, message: '任务已开始' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 完成任务
router.post('/tasks/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { submissionId } = req.body;

    const timestamp = now();
    const { data, error } = await db
      .from('tasks')
      .update({
        status: 'completed',
        submission_id: submissionId || null,
        completed_at: timestamp,
        updated_at: timestamp,
      })
      .eq('id', id)
      .in('status', ['pending', 'in_progress'])
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(400).json({ code: 400, message: '任务不存在或状态不允许完成' });
    }

    res.json({ code: 200, message: '任务已完成' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 重置任务状态
router.post('/tasks/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await db
      .from('tasks')
      .update({
        status: 'pending',
        submission_id: null,
        completed_at: null,
        updated_at: now(),
      })
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({ code: 200, message: '任务已重置' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('relation "tasks" does not exist')) {
      return res.status(500).json({
        code: 500,
        message: '数据库缺少 tasks 表：请在 Supabase SQL Editor 执行 backend/database/fix-missing-tasks-table.sql',
      });
    }
    res.status(500).json({ code: 500, message: msg });
  }
});

// 获取我的任务列表（采集员视角）
router.get('/my/tasks', async (req, res) => {
  try {
    const { projectId, status } = req.query;
    // 注意：实际应用中应该从认证信息中获取当前用户ID
    // 这里暂时返回空数组，等认证系统完善后实现

    let sql = `
      SELECT
        t.id,
        t.project_id as "projectId",
        t.tool_id as "toolId",
        t.assignee_id as "assigneeId",
        t.status,
        t.due_date as "dueDate",
        t.submission_id as "submissionId",
        t.completed_at as "completedAt",
        t.created_at as "createdAt",
        dt.name as "toolName",
        dt.type as "toolType",
        p.name as "projectName"
      FROM tasks t
      LEFT JOIN data_tools dt ON t.tool_id = dt.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (projectId) {
      sql += ` AND t.project_id = $${paramIndex++}`;
      params.push(projectId);
    }
    if (status) {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
