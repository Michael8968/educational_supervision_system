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
    res.status(500).json({ code: 500, message: error.message });
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
    res.status(500).json({ code: 500, message: error.message });
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
    res.status(500).json({ code: 500, message: error.message });
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

    await db.query(`
      INSERT INTO tasks (id, project_id, tool_id, assignee_id, target_type, target_id, due_date, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $8)
    `, [id, projectId, toolId, assigneeId, targetType || null, targetId || null, dueDate || null, timestamp]);

    res.json({ code: 200, data: { id }, message: '任务创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
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
    let createdCount = 0;

    // 为每个采集员创建任务
    for (const assigneeId of assigneeIds) {
      // 检查是否已存在相同的任务
      const existing = await db.query(`
        SELECT id FROM tasks
        WHERE project_id = $1 AND tool_id = $2 AND assignee_id = $3
      `, [projectId, toolId, assigneeId]);

      if (existing.rows.length === 0) {
        const id = generateId();
        await db.query(`
          INSERT INTO tasks (id, project_id, tool_id, assignee_id, target_type, target_id, due_date, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $8)
        `, [id, projectId, toolId, assigneeId, targetType || null, targetIds?.[0] || null, dueDate || null, timestamp]);
        createdCount++;
      }
    }

    res.json({ code: 200, data: { created: createdCount }, message: `成功创建 ${createdCount} 个任务` });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新任务
router.put('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, dueDate, assigneeId } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      params.push(dueDate);
    }
    if (assigneeId !== undefined) {
      updates.push(`assignee_id = $${paramIndex++}`);
      params.push(assigneeId);
    }

    if (updates.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' });
    }

    updates.push(`updated_at = $${paramIndex++}`);
    params.push(now());
    params.push(id);

    const result = await db.query(`
      UPDATE tasks SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除任务
router.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM tasks WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量删除任务
router.post('/tasks/batch-delete', async (req, res) => {
  try {
    const { taskIds } = req.body;

    if (!taskIds || taskIds.length === 0) {
      return res.status(400).json({ code: 400, message: '任务ID列表不能为空' });
    }

    const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(', ');
    const result = await db.query(`DELETE FROM tasks WHERE id IN (${placeholders})`, taskIds);

    res.json({ code: 200, data: { deleted: result.rowCount }, message: `成功删除 ${result.rowCount} 个任务` });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 开始任务
router.post('/tasks/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE tasks SET status = 'in_progress', updated_at = $1
      WHERE id = $2 AND status = 'pending'
    `, [now(), id]);

    if (result.rowCount === 0) {
      return res.status(400).json({ code: 400, message: '任务不存在或状态不允许开始' });
    }

    res.json({ code: 200, message: '任务已开始' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 完成任务
router.post('/tasks/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { submissionId } = req.body;

    const timestamp = now();
    const result = await db.query(`
      UPDATE tasks SET status = 'completed', submission_id = $1, completed_at = $2, updated_at = $2
      WHERE id = $3 AND status IN ('pending', 'in_progress')
    `, [submissionId || null, timestamp, id]);

    if (result.rowCount === 0) {
      return res.status(400).json({ code: 400, message: '任务不存在或状态不允许完成' });
    }

    res.json({ code: 200, message: '任务已完成' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 重置任务状态
router.post('/tasks/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE tasks SET status = 'pending', submission_id = NULL, completed_at = NULL, updated_at = $1
      WHERE id = $2
    `, [now(), id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '任务不存在' });
    }

    res.json({ code: 200, message: '任务已重置' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
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
