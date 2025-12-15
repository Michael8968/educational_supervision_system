const express = require('express');
const router = express.Router();

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString().split('T')[0];

// ==================== 样本配置 ====================

// 获取项目样本配置
router.get('/projects/:projectId/samples/config', async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(`
      SELECT id, project_id as "projectId",
             district, school, grade, class, student, parent, department, teacher,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM project_sample_config
      WHERE project_id = $1
    `, [projectId]);

    if (result.rows.length === 0) {
      // 返回默认配置
      return res.json({
        code: 200,
        data: {
          projectId,
          district: true,
          school: true,
          grade: false,
          class: false,
          student: false,
          parent: false,
          department: false,
          teacher: true
        }
      });
    }

    res.json({ code: 200, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新项目样本配置
router.put('/projects/:projectId/samples/config', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { district, school, grade, class: classConfig, student, parent, department, teacher } = req.body;

    const timestamp = now();

    // 尝试更新，如果不存在则插入
    const existResult = await db.query(
      'SELECT id FROM project_sample_config WHERE project_id = $1',
      [projectId]
    );

    if (existResult.rows.length > 0) {
      const updates = {
        ...(district !== undefined ? { district } : {}),
        ...(school !== undefined ? { school } : {}),
        ...(grade !== undefined ? { grade } : {}),
        ...(classConfig !== undefined ? { class: classConfig } : {}),
        ...(student !== undefined ? { student } : {}),
        ...(parent !== undefined ? { parent } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(teacher !== undefined ? { teacher } : {}),
        updated_at: timestamp,
      };

      const { error } = await db
        .from('project_sample_config')
        .update(updates)
        .eq('project_id', projectId);
      if (error) throw error;
    } else {
      const id = generateId();
      const { error } = await db
        .from('project_sample_config')
        .insert({
          id,
          project_id: projectId,
          district: district ?? true,
          school: school ?? true,
          grade: grade ?? false,
          class: classConfig ?? false,
          student: student ?? false,
          parent: parent ?? false,
          department: department ?? false,
          teacher: teacher ?? true,
          created_at: timestamp,
          updated_at: timestamp,
        });
      if (error) throw error;
    }

    res.json({ code: 200, message: '配置保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 样本数据 CRUD ====================

// 获取项目样本数据（树形结构）
router.get('/projects/:projectId/samples', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type } = req.query;

    let sql = `
      SELECT id, project_id as "projectId", parent_id as "parentId", type, code, name,
             school_type as "schoolType", teacher_sample_mode as "teacherSampleMode",
             phone, id_card as "idCard", sort_order as "sortOrder", status,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM project_samples
      WHERE project_id = $1
    `;
    const params = [projectId];

    if (type) {
      sql += ` AND type = $2`;
      params.push(type);
    }

    sql += ' ORDER BY type, sort_order, created_at';

    const result = await db.query(sql, params);

    // 构建树形结构
    const samples = result.rows;
    const sampleMap = new Map();
    const tree = [];

    // 首先将所有样本放入 map
    samples.forEach(sample => {
      sample.children = [];
      sampleMap.set(sample.id, sample);
    });

    // 构建树
    samples.forEach(sample => {
      if (sample.parentId && sampleMap.has(sample.parentId)) {
        sampleMap.get(sample.parentId).children.push(sample);
      } else if (!sample.parentId) {
        tree.push(sample);
      }
    });

    res.json({ code: 200, data: tree });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取项目样本数据（平铺列表）
router.get('/projects/:projectId/samples/list', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type, parentId } = req.query;

    let sql = `
      SELECT id, project_id as "projectId", parent_id as "parentId", type, code, name,
             school_type as "schoolType", teacher_sample_mode as "teacherSampleMode",
             phone, id_card as "idCard", sort_order as "sortOrder", status,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM project_samples
      WHERE project_id = $1
    `;
    const params = [projectId];
    let paramIndex = 2;

    if (type) {
      sql += ` AND type = $${paramIndex++}`;
      params.push(type);
    }

    if (parentId) {
      sql += ` AND parent_id = $${paramIndex++}`;
      params.push(parentId);
    }

    sql += ' ORDER BY sort_order, created_at';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加区县样本
router.post('/projects/:projectId/samples/districts', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { code, name } = req.body;

    if (!name) {
      return res.status(400).json({ code: 400, message: '区县名称为必填项' });
    }

    const id = generateId();
    const timestamp = now();

    const { error } = await db
      .from('project_samples')
      .insert({
        id,
        project_id: projectId,
        type: 'district',
        code: code || '',
        name,
        created_at: timestamp,
        updated_at: timestamp,
      });
    if (error) throw error;

    res.json({ code: 200, data: { id }, message: '添加成功' });
  } catch (error) {
    if (error.code === '23505') { // unique violation
      return res.status(400).json({ code: 400, message: '该区县已存在' });
    }
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加学校样本
router.post('/projects/:projectId/samples/schools', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { parentId, code, name, schoolType, teacherSampleMode } = req.body;

    if (!name) {
      return res.status(400).json({ code: 400, message: '学校名称为必填项' });
    }

    const id = generateId();
    const timestamp = now();

    const { error } = await db
      .from('project_samples')
      .insert({
        id,
        project_id: projectId,
        parent_id: parentId || null,
        type: 'school',
        code: code || '',
        name,
        school_type: schoolType || '',
        teacher_sample_mode: teacherSampleMode || 'self',
        created_at: timestamp,
        updated_at: timestamp,
      });
    if (error) throw error;

    res.json({ code: 200, data: { id }, message: '添加成功' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ code: 400, message: '该学校已存在' });
    }
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 添加教师样本
router.post('/projects/:projectId/samples/teachers', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { parentId, name, phone, idCard } = req.body;

    if (!name) {
      return res.status(400).json({ code: 400, message: '教师姓名为必填项' });
    }

    if (!parentId) {
      return res.status(400).json({ code: 400, message: '请指定所属学校' });
    }

    const id = generateId();
    const timestamp = now();

    const { error } = await db
      .from('project_samples')
      .insert({
        id,
        project_id: projectId,
        parent_id: parentId,
        type: 'teacher',
        name,
        phone: phone || '',
        id_card: idCard || '',
        created_at: timestamp,
        updated_at: timestamp,
      });
    if (error) throw error;

    res.json({ code: 200, data: { id }, message: '添加成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新样本
router.put('/projects/:projectId/samples/:id', async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const { code, name, schoolType, teacherSampleMode, phone, idCard, sortOrder, status } = req.body;

    const timestamp = now();

    const updates = {
      ...(code !== undefined ? { code } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(schoolType !== undefined ? { school_type: schoolType } : {}),
      ...(teacherSampleMode !== undefined ? { teacher_sample_mode: teacherSampleMode } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(idCard !== undefined ? { id_card: idCard } : {}),
      ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
      ...(status !== undefined ? { status } : {}),
      updated_at: timestamp,
    };

    const { data, error } = await db
      .from('project_samples')
      .update(updates)
      .eq('id', id)
      .eq('project_id', projectId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '样本不存在' });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除样本（级联删除子样本）
router.delete('/projects/:projectId/samples/:id', async (req, res) => {
  try {
    const { projectId, id } = req.params;

    // 先获取样本类型
    const sampleResult = await db.query(
      'SELECT type FROM project_samples WHERE id = $1 AND project_id = $2',
      [id, projectId]
    );

    if (sampleResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '样本不存在' });
    }

    // 递归删除子样本
    const deleteRecursive = async (parentId) => {
      const { data: children, error } = await db
        .from('project_samples')
        .select('id')
        .eq('parent_id', parentId);
      if (error) throw error;

      for (const child of children || []) {
        await deleteRecursive(child.id);
      }

      const { error: delErr } = await db
        .from('project_samples')
        .delete()
        .eq('id', parentId);
      if (delErr) throw delErr;
    };

    await deleteRecursive(id);

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量导入样本
router.post('/projects/:projectId/samples/import', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { samples, type } = req.body;

    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({ code: 400, message: '请提供样本数据' });
    }

    const validTypes = ['district', 'school', 'teacher'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ code: 400, message: '无效的样本类型' });
    }

    const timestamp = now();
    const results = { success: 0, failed: 0, errors: [] };

    for (const sample of samples) {
      try {
        if (!sample.name) {
          results.failed++;
          results.errors.push('名称为必填项');
          continue;
        }

        const id = generateId();
        const { error } = await db
          .from('project_samples')
          .insert({
            id,
            project_id: projectId,
            parent_id: sample.parentId || null,
            type,
            code: sample.code || '',
            name: sample.name,
            school_type: sample.schoolType || '',
            teacher_sample_mode: sample.teacherSampleMode || 'self',
            phone: sample.phone || '',
            id_card: sample.idCard || '',
            created_at: timestamp,
            updated_at: timestamp,
          });
        if (error) throw error;

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${sample.name}: ${err.message}`);
      }
    }

    res.json({
      code: 200,
      data: results,
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条`
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取样本统计
router.get('/projects/:projectId/samples/stats', async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(`
      SELECT type, COUNT(*) as count
      FROM project_samples
      WHERE project_id = $1 AND status = 'active'
      GROUP BY type
    `, [projectId]);

    const stats = {
      total: 0,
      district: 0,
      school: 0,
      teacher: 0,
      grade: 0,
      class: 0,
      student: 0
    };

    result.rows.forEach(row => {
      stats[row.type] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    res.json({ code: 200, data: stats });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
