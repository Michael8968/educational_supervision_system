/**
 * 评估任务路由
 * 管理评估专家的评估任务（替代原审核任务分配功能）
 */

const express = require('express');
const router = express.Router();

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// ==================== 辅助函数 ====================

/**
 * 从请求头解析当前用户信息
 */
const parseCurrentUser = (req) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  let phone = '';
  let name = '';

  if (token) {
    const parts = token.split('-');
    if (parts.length >= 4) {
      try {
        const encodedPhone = parts[3];
        phone = Buffer.from(encodedPhone, 'base64').toString('utf-8');
      } catch (e) {
        console.error('[evaluation] 解析 token 失败:', e);
      }

      try {
        const sessionStore = require('../services/sessionStore');
        const ts = parseInt(parts[1], 10);
        const session = sessionStore.getSession(ts);
        if (session) {
          name = session.name || '';
        }
      } catch (e) {
        // Session 不存在也没关系
      }
    }
  }

  return { phone, name };
};

// ==================== 专家端 API ====================

/**
 * 获取当前专家的评估任务列表
 * GET /api/expert/evaluations
 */
router.get('/expert/evaluations', async (req, res) => {
  try {
    const { phone, name } = parseCurrentUser(req);
    const { projectId, status } = req.query;

    if (!phone && !name) {
      return res.status(401).json({ code: 401, message: '未登录或登录已过期' });
    }

    // 先获取当前用户在 project_personnel 中的 ID
    let sql = `
      SELECT
        ea.id,
        ea.project_id as "projectId",
        p.name as "projectName",
        ea.target_type as "targetType",
        ea.target_id as "targetId",
        ps.name as "targetName",
        ea.status,
        ea.due_date as "dueDate",
        ea.assigned_at as "assignedAt",
        ea.started_at as "startedAt",
        ea.completed_at as "completedAt",
        ea.created_at as "createdAt"
      FROM expert_assignments ea
      INNER JOIN projects p ON ea.project_id = p.id
      INNER JOIN project_personnel pp ON ea.expert_id = pp.id
      LEFT JOIN project_samples ps ON ea.target_id = ps.id
      WHERE (pp.phone = $1 OR pp.name = $2)
        AND pp.role = 'project_expert'
    `;

    const params = [phone, name];
    let paramIndex = 3;

    if (projectId) {
      sql += ` AND ea.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }

    if (status) {
      sql += ` AND ea.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ` ORDER BY ea.created_at DESC`;

    const result = await db.query(sql, params);

    // 为每个任务计算评分进度
    const evaluationsWithProgress = await Promise.all(result.rows.map(async (evaluation) => {
      // 获取已评分指标数
      const scoredResult = await db.query(`
        SELECT COUNT(*) as scored
        FROM indicator_scores
        WHERE assignment_id = $1
      `, [evaluation.id]);

      // 获取总指标数（从项目指标体系中获取末级指标）
      const totalResult = await db.query(`
        SELECT COUNT(*) as total
        FROM indicators i
        INNER JOIN indicator_systems ins ON i.system_id = ins.id
        INNER JOIN projects p ON p.indicator_system_id = ins.id
        WHERE p.id = $1
          AND i.is_leaf = true
      `, [evaluation.projectId]);

      return {
        ...evaluation,
        progress: {
          scored: parseInt(scoredResult.rows[0]?.scored || 0),
          total: parseInt(totalResult.rows[0]?.total || 0),
        },
      };
    }));

    res.json({
      code: 200,
      data: evaluationsWithProgress,
    });
  } catch (error) {
    console.error('[GET /expert/evaluations] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取单个评估任务详情
 * GET /api/expert/evaluations/:id
 */
router.get('/expert/evaluations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 获取评估任务基本信息
    const evaluationResult = await db.query(`
      SELECT
        ea.id,
        ea.project_id as "projectId",
        p.name as "projectName",
        ea.expert_id as "expertId",
        pp.name as "expertName",
        ea.target_type as "targetType",
        ea.target_id as "targetId",
        ps.name as "targetName",
        ea.indicator_scope as "indicatorScope",
        ea.status,
        ea.due_date as "dueDate",
        ea.assigned_at as "assignedAt",
        ea.started_at as "startedAt",
        ea.completed_at as "completedAt"
      FROM expert_assignments ea
      INNER JOIN projects p ON ea.project_id = p.id
      INNER JOIN project_personnel pp ON ea.expert_id = pp.id
      LEFT JOIN project_samples ps ON ea.target_id = ps.id
      WHERE ea.id = $1
    `, [id]);

    if (evaluationResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '评估任务不存在' });
    }

    const evaluation = evaluationResult.rows[0];

    // 获取指标列表及评分状态
    const indicatorsResult = await db.query(`
      SELECT
        i.id,
        i.code,
        i.name,
        i.parent_id as "parentId",
        i.level,
        i.is_leaf as "isLeaf",
        i.description,
        iscore.score,
        iscore.score_level as "scoreLevel",
        iscore.is_compliant as "isCompliant",
        iscore.score_basis as "scoreBasis",
        iscore.scored_at as "scoredAt"
      FROM indicators i
      INNER JOIN indicator_systems ins ON i.system_id = ins.id
      INNER JOIN projects p ON p.indicator_system_id = ins.id
      LEFT JOIN indicator_scores iscore ON iscore.indicator_id = i.id AND iscore.assignment_id = $1
      WHERE p.id = $2
      ORDER BY i.code
    `, [id, evaluation.projectId]);

    // 获取相关填报数据
    const submissionsResult = await db.query(`
      SELECT
        s.id,
        s.form_id as "formId",
        dt.name as "formName",
        s.submitter_name as "submitterName",
        s.submitter_org as "submitterOrg",
        s.status,
        s.submitted_at as "submittedAt",
        s.data
      FROM submissions s
      LEFT JOIN data_tools dt ON s.form_id = dt.id
      WHERE s.project_id = $1
        AND s.school_id = $2
        AND s.status IN ('submitted', 'approved')
      ORDER BY s.submitted_at DESC
    `, [evaluation.projectId, evaluation.targetId]);

    // 获取佐证材料
    const materialsResult = await db.query(`
      SELECT
        sm.id,
        sm.file_name as "fileName",
        sm.file_path as "filePath",
        sm.indicator_id as "indicatorId",
        sm.created_at as "createdAt"
      FROM submission_materials sm
      INNER JOIN submissions s ON sm.submission_id = s.id
      WHERE s.project_id = $1
        AND s.school_id = $2
    `, [evaluation.projectId, evaluation.targetId]);

    res.json({
      code: 200,
      data: {
        evaluation,
        indicators: indicatorsResult.rows,
        submissions: submissionsResult.rows,
        materials: materialsResult.rows,
      },
    });
  } catch (error) {
    console.error('[GET /expert/evaluations/:id] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 开始评估任务
 * POST /api/expert/evaluations/:id/start
 */
router.post('/expert/evaluations/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const timestamp = now();

    // 检查任务状态
    const checkResult = await db.query(`
      SELECT status FROM expert_assignments WHERE id = $1
    `, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '评估任务不存在' });
    }

    if (checkResult.rows[0].status !== 'pending') {
      return res.status(400).json({ code: 400, message: '任务已开始或已完成' });
    }

    // 更新状态
    await db.query(`
      UPDATE expert_assignments
      SET status = 'in_progress', started_at = $1, updated_at = $1
      WHERE id = $2
    `, [timestamp, id]);

    res.json({
      code: 200,
      data: { startedAt: timestamp },
      message: '评估任务已开始',
    });
  } catch (error) {
    console.error('[POST /expert/evaluations/:id/start] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 提交评估任务
 * POST /api/expert/evaluations/:id/submit
 */
router.post('/expert/evaluations/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const { summary } = req.body;
    const timestamp = now();

    // 检查任务状态
    const checkResult = await db.query(`
      SELECT status, project_id, expert_id, target_id, target_type
      FROM expert_assignments WHERE id = $1
    `, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '评估任务不存在' });
    }

    const task = checkResult.rows[0];
    if (task.status === 'submitted') {
      return res.status(400).json({ code: 400, message: '任务已提交' });
    }

    // 检查是否有评分
    const scoreCountResult = await db.query(`
      SELECT COUNT(*) as count FROM indicator_scores WHERE assignment_id = $1
    `, [id]);

    if (parseInt(scoreCountResult.rows[0].count) === 0) {
      return res.status(400).json({ code: 400, message: '请先完成指标评分' });
    }

    // 计算综合结果
    const statsResult = await db.query(`
      SELECT
        AVG(score) as avg_score,
        COUNT(*) as total,
        SUM(CASE WHEN is_compliant THEN 1 ELSE 0 END) as compliant_count
      FROM indicator_scores
      WHERE assignment_id = $1
    `, [id]);

    const stats = statsResult.rows[0];
    const overallScore = parseFloat(stats.avg_score) || 0;
    const complianceRate = stats.total > 0 ? parseInt(stats.compliant_count) / parseInt(stats.total) : 0;

    // 确定等级
    let overallLevel = '不合格';
    if (overallScore >= 90) overallLevel = '优秀';
    else if (overallScore >= 80) overallLevel = '良好';
    else if (overallScore >= 60) overallLevel = '合格';

    // 获取评语汇总
    const commentsResult = await db.query(`
      SELECT comment_type, content
      FROM evaluation_comments
      WHERE assignment_id = $1
      ORDER BY priority DESC
    `, [id]);

    const strengths = commentsResult.rows.filter(c => c.comment_type === 'strength').map(c => c.content);
    const weaknesses = commentsResult.rows.filter(c => c.comment_type === 'weakness').map(c => c.content);
    const suggestions = commentsResult.rows.filter(c => c.comment_type === 'suggestion').map(c => c.content);

    // 创建或更新评估结论
    const resultId = generateId();
    await db.query(`
      INSERT INTO evaluation_results (
        id, assignment_id, project_id, expert_id, target_id, target_type,
        overall_score, overall_level, is_compliant, compliance_rate,
        summary, main_strengths, main_weaknesses, key_suggestions,
        status, submitted_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'submitted', $15, $15, $15)
      ON CONFLICT (assignment_id) DO UPDATE SET
        overall_score = EXCLUDED.overall_score,
        overall_level = EXCLUDED.overall_level,
        is_compliant = EXCLUDED.is_compliant,
        compliance_rate = EXCLUDED.compliance_rate,
        summary = EXCLUDED.summary,
        main_strengths = EXCLUDED.main_strengths,
        main_weaknesses = EXCLUDED.main_weaknesses,
        key_suggestions = EXCLUDED.key_suggestions,
        status = 'submitted',
        submitted_at = EXCLUDED.submitted_at,
        updated_at = EXCLUDED.updated_at
    `, [
      resultId, id, task.project_id, task.expert_id, task.target_id, task.target_type,
      overallScore, overallLevel, complianceRate >= 0.8, complianceRate,
      summary || '', JSON.stringify(strengths), JSON.stringify(weaknesses), JSON.stringify(suggestions),
      timestamp,
    ]);

    // 更新任务状态
    await db.query(`
      UPDATE expert_assignments
      SET status = 'submitted', completed_at = $1, updated_at = $1
      WHERE id = $2
    `, [timestamp, id]);

    res.json({
      code: 200,
      data: {
        submittedAt: timestamp,
        overallScore,
        overallLevel,
        complianceRate,
      },
      message: '评估已提交',
    });
  } catch (error) {
    console.error('[POST /expert/evaluations/:id/submit] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 指标评分 API ====================

/**
 * 获取指标评分标准
 * GET /api/projects/:projectId/indicators/:indicatorId/scoring-standard
 */
router.get('/projects/:projectId/indicators/:indicatorId/scoring-standard', async (req, res) => {
  try {
    const { projectId, indicatorId } = req.params;

    // 查询评分标准
    const result = await db.query(`
      SELECT
        scoring_type as "scoringType",
        max_score as "maxScore",
        min_score as "minScore",
        pass_score as "passScore",
        levels,
        scoring_guide as "scoringGuide",
        reference_materials as "referenceMaterials"
      FROM scoring_standards
      WHERE project_id = $1 AND indicator_id = $2
    `, [projectId, indicatorId]);

    if (result.rows.length === 0) {
      // 返回默认评分标准
      return res.json({
        code: 200,
        data: {
          scoringType: 'level',
          maxScore: 100,
          minScore: 0,
          passScore: 60,
          levels: [
            { level: 'A', label: '优秀', min: 90, max: 100 },
            { level: 'B', label: '良好', min: 80, max: 89 },
            { level: 'C', label: '合格', min: 60, max: 79 },
            { level: 'D', label: '不合格', min: 0, max: 59 },
          ],
          scoringGuide: null,
          referenceMaterials: null,
        },
      });
    }

    const standard = result.rows[0];
    if (standard.levels) {
      standard.levels = JSON.parse(standard.levels);
    }
    if (standard.referenceMaterials) {
      standard.referenceMaterials = JSON.parse(standard.referenceMaterials);
    }

    res.json({ code: 200, data: standard });
  } catch (error) {
    console.error('[GET scoring-standard] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取指标相关数据（用于评分参考）
 * GET /api/expert/evaluations/:evaluationId/indicators/:indicatorId/data
 */
router.get('/expert/evaluations/:evaluationId/indicators/:indicatorId/data', async (req, res) => {
  try {
    const { evaluationId, indicatorId } = req.params;

    // 获取评估任务信息
    const evalResult = await db.query(`
      SELECT project_id, target_id FROM expert_assignments WHERE id = $1
    `, [evaluationId]);

    if (evalResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '评估任务不存在' });
    }

    const { project_id: projectId, target_id: targetId } = evalResult.rows[0];

    // 获取指标信息
    const indicatorResult = await db.query(`
      SELECT id, code, name, description, threshold, unit
      FROM indicators WHERE id = $1
    `, [indicatorId]);

    if (indicatorResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '指标不存在' });
    }

    const indicator = indicatorResult.rows[0];

    // 获取实际数据（从 school_indicator_data 表）
    const actualDataResult = await db.query(`
      SELECT actual_value, data_source, collected_at
      FROM school_indicator_data
      WHERE project_id = $1 AND school_id = $2 AND indicator_id = $3
      ORDER BY collected_at DESC
      LIMIT 1
    `, [projectId, targetId, indicatorId]);

    // 获取对比数据（区县平均）
    const comparisonResult = await db.query(`
      SELECT AVG(actual_value) as district_avg
      FROM school_indicator_data
      WHERE project_id = $1 AND indicator_id = $2
    `, [projectId, indicatorId]);

    // 获取相关佐证材料
    const materialsResult = await db.query(`
      SELECT sm.id, sm.file_name as "fileName", sm.file_path as "filePath"
      FROM submission_materials sm
      INNER JOIN submissions s ON sm.submission_id = s.id
      WHERE s.project_id = $1 AND s.school_id = $2 AND sm.indicator_id = $3
    `, [projectId, targetId, indicatorId]);

    res.json({
      code: 200,
      data: {
        indicator: {
          id: indicator.id,
          code: indicator.code,
          name: indicator.name,
          description: indicator.description,
          threshold: indicator.threshold,
          unit: indicator.unit,
        },
        actualData: actualDataResult.rows[0] || null,
        comparisonData: {
          districtAvg: comparisonResult.rows[0]?.district_avg || null,
        },
        materials: materialsResult.rows,
      },
    });
  } catch (error) {
    console.error('[GET indicator data] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 保存指标评分
 * POST /api/expert/evaluations/:evaluationId/scores
 */
router.post('/expert/evaluations/:evaluationId/scores', async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const { indicatorId, score, scoreLevel, isCompliant, scoreBasis } = req.body;
    const timestamp = now();

    // 获取评估任务信息
    const evalResult = await db.query(`
      SELECT project_id, expert_id, target_id FROM expert_assignments WHERE id = $1
    `, [evaluationId]);

    if (evalResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '评估任务不存在' });
    }

    const { project_id: projectId, expert_id: expertId, target_id: targetId } = evalResult.rows[0];

    // 获取指标编码
    const indicatorResult = await db.query(`
      SELECT code FROM indicators WHERE id = $1
    `, [indicatorId]);

    const indicatorCode = indicatorResult.rows[0]?.code || null;

    // 插入或更新评分
    const scoreId = generateId();
    await db.query(`
      INSERT INTO indicator_scores (
        id, assignment_id, project_id, expert_id, target_id,
        indicator_id, indicator_code, score, score_level, is_compliant,
        score_basis, scored_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
      ON CONFLICT (assignment_id, indicator_id) DO UPDATE SET
        score = EXCLUDED.score,
        score_level = EXCLUDED.score_level,
        is_compliant = EXCLUDED.is_compliant,
        score_basis = EXCLUDED.score_basis,
        updated_at = EXCLUDED.updated_at
    `, [
      scoreId, evaluationId, projectId, expertId, targetId,
      indicatorId, indicatorCode, score, scoreLevel, isCompliant,
      scoreBasis, timestamp,
    ]);

    res.json({
      code: 200,
      data: { scoreId, savedAt: timestamp },
      message: '评分已保存',
    });
  } catch (error) {
    console.error('[POST scores] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 批量保存评分
 * POST /api/expert/evaluations/:evaluationId/scores/batch
 */
router.post('/expert/evaluations/:evaluationId/scores/batch', async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const { scores } = req.body;
    const timestamp = now();

    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ code: 400, message: '评分数据不能为空' });
    }

    // 获取评估任务信息
    const evalResult = await db.query(`
      SELECT project_id, expert_id, target_id FROM expert_assignments WHERE id = $1
    `, [evaluationId]);

    if (evalResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '评估任务不存在' });
    }

    const { project_id: projectId, expert_id: expertId, target_id: targetId } = evalResult.rows[0];

    // 批量插入或更新
    for (const item of scores) {
      const scoreId = generateId();
      await db.query(`
        INSERT INTO indicator_scores (
          id, assignment_id, project_id, expert_id, target_id,
          indicator_id, indicator_code, score, score_level, is_compliant,
          score_basis, scored_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
        ON CONFLICT (assignment_id, indicator_id) DO UPDATE SET
          score = EXCLUDED.score,
          score_level = EXCLUDED.score_level,
          is_compliant = EXCLUDED.is_compliant,
          score_basis = EXCLUDED.score_basis,
          updated_at = EXCLUDED.updated_at
      `, [
        scoreId, evaluationId, projectId, expertId, targetId,
        item.indicatorId, item.indicatorCode || null, item.score, item.scoreLevel, item.isCompliant,
        item.scoreBasis || null, timestamp,
      ]);
    }

    res.json({
      code: 200,
      data: { savedCount: scores.length, savedAt: timestamp },
      message: `已保存 ${scores.length} 条评分`,
    });
  } catch (error) {
    console.error('[POST scores/batch] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 评价评语 API ====================

/**
 * 获取评估评语
 * GET /api/expert/evaluations/:evaluationId/comments
 */
router.get('/expert/evaluations/:evaluationId/comments', async (req, res) => {
  try {
    const { evaluationId } = req.params;

    const result = await db.query(`
      SELECT
        id,
        comment_type as "commentType",
        content,
        related_indicators as "relatedIndicators",
        priority,
        created_at as "createdAt"
      FROM evaluation_comments
      WHERE assignment_id = $1
      ORDER BY comment_type, priority DESC
    `, [evaluationId]);

    // 按类型分组
    const comments = {
      strengths: result.rows.filter(c => c.commentType === 'strength'),
      weaknesses: result.rows.filter(c => c.commentType === 'weakness'),
      suggestions: result.rows.filter(c => c.commentType === 'suggestion'),
      highlights: result.rows.filter(c => c.commentType === 'highlight'),
      overall: result.rows.filter(c => c.commentType === 'overall'),
    };

    // 解析 JSON 字段
    for (const key of Object.keys(comments)) {
      comments[key] = comments[key].map(c => ({
        ...c,
        relatedIndicators: c.relatedIndicators ? JSON.parse(c.relatedIndicators) : [],
      }));
    }

    res.json({ code: 200, data: { comments } });
  } catch (error) {
    console.error('[GET comments] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 添加评语
 * POST /api/expert/evaluations/:evaluationId/comments
 */
router.post('/expert/evaluations/:evaluationId/comments', async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const { commentType, content, relatedIndicators, priority } = req.body;
    const timestamp = now();

    // 获取评估任务信息
    const evalResult = await db.query(`
      SELECT project_id, expert_id, target_id FROM expert_assignments WHERE id = $1
    `, [evaluationId]);

    if (evalResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '评估任务不存在' });
    }

    const { project_id: projectId, expert_id: expertId, target_id: targetId } = evalResult.rows[0];

    const commentId = generateId();
    await db.query(`
      INSERT INTO evaluation_comments (
        id, assignment_id, project_id, expert_id, target_id,
        comment_type, content, related_indicators, priority, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      commentId, evaluationId, projectId, expertId, targetId,
      commentType, content, JSON.stringify(relatedIndicators || []), priority || 0, timestamp,
    ]);

    res.json({
      code: 200,
      data: { id: commentId, createdAt: timestamp },
      message: '评语已添加',
    });
  } catch (error) {
    console.error('[POST comments] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 更新评语
 * PUT /api/expert/comments/:commentId
 */
router.put('/expert/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content, relatedIndicators, priority } = req.body;
    const timestamp = now();

    await db.query(`
      UPDATE evaluation_comments
      SET content = $1, related_indicators = $2, priority = $3, updated_at = $4
      WHERE id = $5
    `, [content, JSON.stringify(relatedIndicators || []), priority || 0, timestamp, commentId]);

    res.json({ code: 200, message: '评语已更新' });
  } catch (error) {
    console.error('[PUT comments] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 删除评语
 * DELETE /api/expert/comments/:commentId
 */
router.delete('/expert/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;

    await db.query(`DELETE FROM evaluation_comments WHERE id = $1`, [commentId]);

    res.json({ code: 200, message: '评语已删除' });
  } catch (error) {
    console.error('[DELETE comments] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 评估结论 API ====================

/**
 * 获取评估结论
 * GET /api/expert/evaluations/:evaluationId/result
 */
router.get('/expert/evaluations/:evaluationId/result', async (req, res) => {
  try {
    const { evaluationId } = req.params;

    // 获取结论
    const resultQuery = await db.query(`
      SELECT
        id,
        overall_score as "overallScore",
        overall_level as "overallLevel",
        is_compliant as "isCompliant",
        compliance_rate as "complianceRate",
        summary,
        main_strengths as "mainStrengths",
        main_weaknesses as "mainWeaknesses",
        key_suggestions as "keySuggestions",
        status,
        submitted_at as "submittedAt",
        confirmed_at as "confirmedAt"
      FROM evaluation_results
      WHERE assignment_id = $1
    `, [evaluationId]);

    // 获取评分分布
    const distributionQuery = await db.query(`
      SELECT
        score_level as "level",
        COUNT(*) as count
      FROM indicator_scores
      WHERE assignment_id = $1
      GROUP BY score_level
    `, [evaluationId]);

    const result = resultQuery.rows[0] || null;
    if (result) {
      result.mainStrengths = result.mainStrengths ? JSON.parse(result.mainStrengths) : [];
      result.mainWeaknesses = result.mainWeaknesses ? JSON.parse(result.mainWeaknesses) : [];
      result.keySuggestions = result.keySuggestions ? JSON.parse(result.keySuggestions) : [];
    }

    const distribution = {};
    distributionQuery.rows.forEach(row => {
      distribution[row.level] = parseInt(row.count);
    });

    res.json({
      code: 200,
      data: {
        result,
        scoreDistribution: distribution,
      },
    });
  } catch (error) {
    console.error('[GET result] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 保存评估结论（草稿）
 * PUT /api/expert/evaluations/:evaluationId/result
 */
router.put('/expert/evaluations/:evaluationId/result', async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const { summary, mainStrengths, mainWeaknesses, keySuggestions } = req.body;
    const timestamp = now();

    // 获取评估任务信息
    const evalResult = await db.query(`
      SELECT project_id, expert_id, target_id, target_type FROM expert_assignments WHERE id = $1
    `, [evaluationId]);

    if (evalResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '评估任务不存在' });
    }

    const task = evalResult.rows[0];

    // 计算评分统计
    const statsResult = await db.query(`
      SELECT
        AVG(score) as avg_score,
        COUNT(*) as total,
        SUM(CASE WHEN is_compliant THEN 1 ELSE 0 END) as compliant_count
      FROM indicator_scores
      WHERE assignment_id = $1
    `, [evaluationId]);

    const stats = statsResult.rows[0];
    const overallScore = parseFloat(stats.avg_score) || 0;
    const complianceRate = stats.total > 0 ? parseInt(stats.compliant_count) / parseInt(stats.total) : 0;

    let overallLevel = '不合格';
    if (overallScore >= 90) overallLevel = '优秀';
    else if (overallScore >= 80) overallLevel = '良好';
    else if (overallScore >= 60) overallLevel = '合格';

    // 插入或更新结论
    const resultId = generateId();
    await db.query(`
      INSERT INTO evaluation_results (
        id, assignment_id, project_id, expert_id, target_id, target_type,
        overall_score, overall_level, is_compliant, compliance_rate,
        summary, main_strengths, main_weaknesses, key_suggestions,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft', $15, $15)
      ON CONFLICT (assignment_id) DO UPDATE SET
        overall_score = EXCLUDED.overall_score,
        overall_level = EXCLUDED.overall_level,
        is_compliant = EXCLUDED.is_compliant,
        compliance_rate = EXCLUDED.compliance_rate,
        summary = EXCLUDED.summary,
        main_strengths = EXCLUDED.main_strengths,
        main_weaknesses = EXCLUDED.main_weaknesses,
        key_suggestions = EXCLUDED.key_suggestions,
        updated_at = EXCLUDED.updated_at
    `, [
      resultId, evaluationId, task.project_id, task.expert_id, task.target_id, task.target_type,
      overallScore, overallLevel, complianceRate >= 0.8, complianceRate,
      summary || '', JSON.stringify(mainStrengths || []), JSON.stringify(mainWeaknesses || []), JSON.stringify(keySuggestions || []),
      timestamp,
    ]);

    res.json({
      code: 200,
      data: { overallScore, overallLevel, complianceRate, savedAt: timestamp },
      message: '评估结论已保存',
    });
  } catch (error) {
    console.error('[PUT result] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 项目管理员 API ====================

/**
 * 分配评估任务
 * POST /api/projects/:projectId/expert-assignments
 */
router.post('/projects/:projectId/expert-assignments', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { expertId, targets, dueDate } = req.body;
    const timestamp = now();

    if (!expertId || !targets || !Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ code: 400, message: '参数不完整' });
    }

    const assignedIds = [];

    for (const target of targets) {
      const assignmentId = generateId();

      // 检查是否已存在
      const existingResult = await db.query(`
        SELECT id FROM expert_assignments
        WHERE project_id = $1 AND expert_id = $2 AND target_id = $3
      `, [projectId, expertId, target.id]);

      if (existingResult.rows.length > 0) {
        // 已存在，跳过
        continue;
      }

      await db.query(`
        INSERT INTO expert_assignments (
          id, project_id, expert_id, target_type, target_id,
          status, assigned_at, due_date, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $6)
      `, [assignmentId, projectId, expertId, target.type, target.id, timestamp, dueDate || null]);

      assignedIds.push(assignmentId);
    }

    res.json({
      code: 200,
      data: { assignedCount: assignedIds.length, assignedIds },
      message: `已分配 ${assignedIds.length} 个评估任务`,
    });
  } catch (error) {
    console.error('[POST expert-assignments] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取项目评估任务统计
 * GET /api/projects/:projectId/expert-assignments/stats
 */
router.get('/projects/:projectId/expert-assignments/stats', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 总体统计
    const totalResult = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted
      FROM expert_assignments
      WHERE project_id = $1
    `, [projectId]);

    // 按专家统计
    const byExpertResult = await db.query(`
      SELECT
        ea.expert_id as "expertId",
        pp.name as "expertName",
        COUNT(*) as total,
        SUM(CASE WHEN ea.status IN ('completed', 'submitted') THEN 1 ELSE 0 END) as completed
      FROM expert_assignments ea
      INNER JOIN project_personnel pp ON ea.expert_id = pp.id
      WHERE ea.project_id = $1
      GROUP BY ea.expert_id, pp.name
    `, [projectId]);

    res.json({
      code: 200,
      data: {
        ...totalResult.rows[0],
        byExpert: byExpertResult.rows,
      },
    });
  } catch (error) {
    console.error('[GET expert-assignments/stats] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 确认评估结论
 * POST /api/projects/:projectId/evaluation-results/:resultId/confirm
 */
router.post('/projects/:projectId/evaluation-results/:resultId/confirm', async (req, res) => {
  try {
    const { resultId } = req.params;
    const { phone } = parseCurrentUser(req);
    const timestamp = now();

    await db.query(`
      UPDATE evaluation_results
      SET status = 'confirmed', confirmed_at = $1, confirmed_by = $2, updated_at = $1
      WHERE id = $3
    `, [timestamp, phone, resultId]);

    res.json({ code: 200, message: '评估结论已确认' });
  } catch (error) {
    console.error('[POST confirm] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 问题台账 API ====================

/**
 * 生成问题编号
 */
const generateIssueCode = async (projectId) => {
  const result = await db.query(`
    SELECT COUNT(*) as count FROM issue_registry WHERE project_id = $1
  `, [projectId]);
  const count = parseInt(result.rows[0].count) + 1;
  return `ISS-${projectId.slice(-4).toUpperCase()}-${String(count).padStart(4, '0')}`;
};

/**
 * 登记问题
 * POST /api/expert/evaluations/:evaluationId/issues
 */
router.post('/expert/evaluations/:evaluationId/issues', async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const {
      title,
      description,
      relatedIndicators,
      severity,
      rectificationDeadline,
      rectificationSuggestion,
    } = req.body;
    const timestamp = now();

    if (!title) {
      return res.status(400).json({ code: 400, message: '问题标题不能为空' });
    }

    // 获取评估任务信息
    const evalResult = await db.query(`
      SELECT project_id, expert_id, target_id, target_type
      FROM expert_assignments WHERE id = $1
    `, [evaluationId]);

    if (evalResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '评估任务不存在' });
    }

    const task = evalResult.rows[0];
    const issueId = generateId();
    const issueCode = await generateIssueCode(task.project_id);

    await db.query(`
      INSERT INTO issue_registry (
        id, project_id, target_id, target_type,
        issue_code, title, description, related_indicators, severity,
        found_by, found_at, evaluation_id,
        rectification_required, rectification_deadline, rectification_suggestion,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'open', $11)
    `, [
      issueId, task.project_id, task.target_id, task.target_type,
      issueCode, title, description || null, JSON.stringify(relatedIndicators || []), severity || 'medium',
      task.expert_id, timestamp, evaluationId,
      true, rectificationDeadline || null, rectificationSuggestion || null,
    ]);

    res.json({
      code: 200,
      data: { id: issueId, issueCode, createdAt: timestamp },
      message: '问题已登记',
    });
  } catch (error) {
    console.error('[POST issues] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取评估任务相关问题列表
 * GET /api/expert/evaluations/:evaluationId/issues
 */
router.get('/expert/evaluations/:evaluationId/issues', async (req, res) => {
  try {
    const { evaluationId } = req.params;

    const result = await db.query(`
      SELECT
        ir.id,
        ir.issue_code as "issueCode",
        ir.title,
        ir.description,
        ir.related_indicators as "relatedIndicators",
        ir.severity,
        ir.status,
        ir.rectification_required as "rectificationRequired",
        ir.rectification_deadline as "rectificationDeadline",
        ir.rectification_suggestion as "rectificationSuggestion",
        ir.rectified_at as "rectifiedAt",
        ir.review_status as "reviewStatus",
        ir.review_result as "reviewResult",
        ir.found_at as "foundAt",
        ir.created_at as "createdAt"
      FROM issue_registry ir
      WHERE ir.evaluation_id = $1
      ORDER BY
        CASE ir.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        ir.created_at DESC
    `, [evaluationId]);

    // 解析 JSON 字段
    const issues = result.rows.map(row => ({
      ...row,
      relatedIndicators: row.relatedIndicators ? JSON.parse(row.relatedIndicators) : [],
    }));

    res.json({ code: 200, data: issues });
  } catch (error) {
    console.error('[GET issues] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取项目问题列表（管理员用）
 * GET /api/projects/:projectId/issues
 */
router.get('/projects/:projectId/issues', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { targetId, status, severity } = req.query;

    let sql = `
      SELECT
        ir.id,
        ir.issue_code as "issueCode",
        ir.title,
        ir.description,
        ir.related_indicators as "relatedIndicators",
        ir.severity,
        ir.target_id as "targetId",
        ir.target_type as "targetType",
        ps.name as "targetName",
        ir.status,
        ir.rectification_required as "rectificationRequired",
        ir.rectification_deadline as "rectificationDeadline",
        ir.rectification_suggestion as "rectificationSuggestion",
        ir.rectified_at as "rectifiedAt",
        ir.rectification_evidence as "rectificationEvidence",
        ir.review_status as "reviewStatus",
        ir.review_result as "reviewResult",
        ir.review_comment as "reviewComment",
        pp.name as "foundByName",
        ir.found_at as "foundAt",
        ir.created_at as "createdAt"
      FROM issue_registry ir
      LEFT JOIN project_samples ps ON ir.target_id = ps.id
      LEFT JOIN project_personnel pp ON ir.found_by = pp.id
      WHERE ir.project_id = $1
    `;

    const params = [projectId];
    let paramIndex = 2;

    if (targetId) {
      sql += ` AND ir.target_id = $${paramIndex}`;
      params.push(targetId);
      paramIndex++;
    }

    if (status) {
      sql += ` AND ir.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (severity) {
      sql += ` AND ir.severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    sql += `
      ORDER BY
        CASE ir.status WHEN 'open' THEN 1 WHEN 'rectifying' THEN 2 ELSE 3 END,
        CASE ir.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        ir.created_at DESC
    `;

    const result = await db.query(sql, params);

    // 解析 JSON 字段
    const issues = result.rows.map(row => ({
      ...row,
      relatedIndicators: row.relatedIndicators ? JSON.parse(row.relatedIndicators) : [],
      rectificationEvidence: row.rectificationEvidence ? JSON.parse(row.rectificationEvidence) : [],
    }));

    res.json({ code: 200, data: issues });
  } catch (error) {
    console.error('[GET project issues] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取问题统计
 * GET /api/projects/:projectId/issues/stats
 */
router.get('/projects/:projectId/issues/stats', async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'rectifying' THEN 1 ELSE 0 END) as rectifying,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN status = 'waived' THEN 1 ELSE 0 END) as waived,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_severity,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_severity,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_severity
      FROM issue_registry
      WHERE project_id = $1
    `, [projectId]);

    const stats = result.rows[0];

    // 按评估对象统计
    const byTargetResult = await db.query(`
      SELECT
        ir.target_id as "targetId",
        ps.name as "targetName",
        COUNT(*) as total,
        SUM(CASE WHEN ir.status IN ('open', 'rectifying') THEN 1 ELSE 0 END) as pending
      FROM issue_registry ir
      LEFT JOIN project_samples ps ON ir.target_id = ps.id
      WHERE ir.project_id = $1
      GROUP BY ir.target_id, ps.name
      ORDER BY pending DESC
    `, [projectId]);

    res.json({
      code: 200,
      data: {
        total: parseInt(stats.total) || 0,
        open: parseInt(stats.open) || 0,
        rectifying: parseInt(stats.rectifying) || 0,
        resolved: parseInt(stats.resolved) || 0,
        closed: parseInt(stats.closed) || 0,
        waived: parseInt(stats.waived) || 0,
        bySeverity: {
          high: parseInt(stats.high_severity) || 0,
          medium: parseInt(stats.medium_severity) || 0,
          low: parseInt(stats.low_severity) || 0,
        },
        byTarget: byTargetResult.rows,
      },
    });
  } catch (error) {
    console.error('[GET issues stats] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取单个问题详情
 * GET /api/issues/:issueId
 */
router.get('/issues/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;

    const result = await db.query(`
      SELECT
        ir.*,
        ps.name as "targetName",
        pp.name as "foundByName",
        pp2.name as "reviewedByName"
      FROM issue_registry ir
      LEFT JOIN project_samples ps ON ir.target_id = ps.id
      LEFT JOIN project_personnel pp ON ir.found_by = pp.id
      LEFT JOIN project_personnel pp2 ON ir.reviewed_by = pp2.id
      WHERE ir.id = $1
    `, [issueId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '问题不存在' });
    }

    const issue = result.rows[0];
    issue.relatedIndicators = issue.related_indicators ? JSON.parse(issue.related_indicators) : [];
    issue.rectificationEvidence = issue.rectification_evidence ? JSON.parse(issue.rectification_evidence) : [];

    res.json({ code: 200, data: issue });
  } catch (error) {
    console.error('[GET issue] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 更新问题
 * PUT /api/expert/issues/:issueId
 */
router.put('/expert/issues/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;
    const {
      title,
      description,
      relatedIndicators,
      severity,
      rectificationDeadline,
      rectificationSuggestion,
    } = req.body;
    const timestamp = now();

    await db.query(`
      UPDATE issue_registry
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        related_indicators = COALESCE($3, related_indicators),
        severity = COALESCE($4, severity),
        rectification_deadline = COALESCE($5, rectification_deadline),
        rectification_suggestion = COALESCE($6, rectification_suggestion),
        updated_at = $7
      WHERE id = $8
    `, [
      title, description,
      relatedIndicators ? JSON.stringify(relatedIndicators) : null,
      severity, rectificationDeadline, rectificationSuggestion,
      timestamp, issueId,
    ]);

    res.json({ code: 200, message: '问题已更新' });
  } catch (error) {
    console.error('[PUT issue] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 删除问题
 * DELETE /api/expert/issues/:issueId
 */
router.delete('/expert/issues/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params;

    // 只能删除 open 状态的问题
    const checkResult = await db.query(`
      SELECT status FROM issue_registry WHERE id = $1
    `, [issueId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '问题不存在' });
    }

    if (checkResult.rows[0].status !== 'open') {
      return res.status(400).json({ code: 400, message: '只能删除待整改的问题' });
    }

    await db.query(`DELETE FROM issue_registry WHERE id = $1`, [issueId]);

    res.json({ code: 200, message: '问题已删除' });
  } catch (error) {
    console.error('[DELETE issue] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 提交整改证据（被评对象使用）
 * PUT /api/issues/:issueId/rectify
 */
router.put('/issues/:issueId/rectify', async (req, res) => {
  try {
    const { issueId } = req.params;
    const { rectificationEvidence, description } = req.body;
    const timestamp = now();

    await db.query(`
      UPDATE issue_registry
      SET
        status = 'rectifying',
        rectification_evidence = $1,
        rectified_at = $2,
        review_status = 'pending_review',
        updated_at = $2
      WHERE id = $3
    `, [JSON.stringify(rectificationEvidence || []), timestamp, issueId]);

    res.json({ code: 200, message: '整改材料已提交' });
  } catch (error) {
    console.error('[PUT rectify] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 复评问题（专家使用）
 * POST /api/expert/issues/:issueId/review
 */
router.post('/expert/issues/:issueId/review', async (req, res) => {
  try {
    const { issueId } = req.params;
    const { result: reviewResult, comment } = req.body;
    const { phone } = parseCurrentUser(req);
    const timestamp = now();

    if (!reviewResult || !['passed', 'failed'].includes(reviewResult)) {
      return res.status(400).json({ code: 400, message: '请选择复评结果' });
    }

    // 获取专家ID
    let reviewerId = null;
    if (phone) {
      const expertResult = await db.query(`
        SELECT pp.id FROM project_personnel pp
        INNER JOIN issue_registry ir ON pp.project_id = ir.project_id
        WHERE ir.id = $1 AND pp.phone = $2 AND pp.role = 'project_expert'
        LIMIT 1
      `, [issueId, phone]);
      if (expertResult.rows.length > 0) {
        reviewerId = expertResult.rows[0].id;
      }
    }

    const newStatus = reviewResult === 'passed' ? 'resolved' : 'open';

    await db.query(`
      UPDATE issue_registry
      SET
        status = $1,
        review_status = 'reviewed',
        reviewed_by = $2,
        reviewed_at = $3,
        review_result = $4,
        review_comment = $5,
        updated_at = $3
      WHERE id = $6
    `, [newStatus, reviewerId, timestamp, reviewResult, comment || null, issueId]);

    res.json({
      code: 200,
      message: reviewResult === 'passed' ? '复评通过，问题已解决' : '复评不通过，问题返回整改',
    });
  } catch (error) {
    console.error('[POST review] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 关闭问题（管理员使用）
 * POST /api/issues/:issueId/close
 */
router.post('/issues/:issueId/close', async (req, res) => {
  try {
    const { issueId } = req.params;
    const timestamp = now();

    await db.query(`
      UPDATE issue_registry
      SET status = 'closed', updated_at = $1
      WHERE id = $2
    `, [timestamp, issueId]);

    res.json({ code: 200, message: '问题已关闭' });
  } catch (error) {
    console.error('[POST close] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 免于整改（管理员使用）
 * POST /api/issues/:issueId/waive
 */
router.post('/issues/:issueId/waive', async (req, res) => {
  try {
    const { issueId } = req.params;
    const { reason } = req.body;
    const timestamp = now();

    await db.query(`
      UPDATE issue_registry
      SET
        status = 'waived',
        rectification_required = false,
        review_comment = $1,
        updated_at = $2
      WHERE id = $3
    `, [reason || '免于整改', timestamp, issueId]);

    res.json({ code: 200, message: '问题已标记为免于整改' });
  } catch (error) {
    console.error('[POST waive] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 评估报告 API ====================

/**
 * 生成评估报告
 * POST /api/expert/evaluations/:evaluationId/report/generate
 */
router.post('/expert/evaluations/:evaluationId/report/generate', async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const timestamp = now();

    // 获取评估详情
    const evalResult = await db.query(`
      SELECT
        ea.id,
        ea.project_id,
        ea.expert_id,
        ea.target_id,
        ea.target_type,
        p.name as project_name,
        ps.name as target_name,
        pp.name as expert_name
      FROM expert_assignments ea
      INNER JOIN projects p ON ea.project_id = p.id
      LEFT JOIN project_samples ps ON ea.target_id = ps.id
      LEFT JOIN project_personnel pp ON ea.expert_id = pp.id
      WHERE ea.id = $1
    `, [evaluationId]);

    if (evalResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '评估任务不存在' });
    }

    const evaluation = evalResult.rows[0];

    // 获取评估结论
    const resultQuery = await db.query(`
      SELECT * FROM evaluation_results WHERE assignment_id = $1
    `, [evaluationId]);

    if (resultQuery.rows.length === 0) {
      return res.status(400).json({ code: 400, message: '请先完成评估并提交结论' });
    }

    const result = resultQuery.rows[0];

    // 获取指标评分
    const scoresResult = await db.query(`
      SELECT
        iscore.indicator_id,
        iscore.indicator_code,
        i.name as indicator_name,
        iscore.score,
        iscore.score_level,
        iscore.is_compliant,
        iscore.score_basis
      FROM indicator_scores iscore
      INNER JOIN indicators i ON iscore.indicator_id = i.id
      WHERE iscore.assignment_id = $1
      ORDER BY iscore.indicator_code
    `, [evaluationId]);

    // 获取评语
    const commentsResult = await db.query(`
      SELECT comment_type, content, priority
      FROM evaluation_comments
      WHERE assignment_id = $1
      ORDER BY comment_type, priority DESC
    `, [evaluationId]);

    // 获取问题台账
    const issuesResult = await db.query(`
      SELECT issue_code, title, severity, status, rectification_deadline
      FROM issue_registry
      WHERE evaluation_id = $1
      ORDER BY severity, created_at
    `, [evaluationId]);

    // 生成报告数据
    const reportData = {
      id: generateId(),
      evaluationId,
      generatedAt: timestamp,
      projectName: evaluation.project_name,
      targetName: evaluation.target_name,
      targetType: evaluation.target_type,
      expertName: evaluation.expert_name,
      conclusion: {
        overallScore: result.overall_score,
        overallLevel: result.overall_level,
        isCompliant: result.is_compliant,
        complianceRate: result.compliance_rate,
        summary: result.summary,
        mainStrengths: result.main_strengths ? JSON.parse(result.main_strengths) : [],
        mainWeaknesses: result.main_weaknesses ? JSON.parse(result.main_weaknesses) : [],
        keySuggestions: result.key_suggestions ? JSON.parse(result.key_suggestions) : [],
      },
      scores: scoresResult.rows,
      scoreDistribution: {
        A: scoresResult.rows.filter(s => s.score_level === 'A').length,
        B: scoresResult.rows.filter(s => s.score_level === 'B').length,
        C: scoresResult.rows.filter(s => s.score_level === 'C').length,
        D: scoresResult.rows.filter(s => s.score_level === 'D').length,
      },
      comments: {
        strengths: commentsResult.rows.filter(c => c.comment_type === 'strength').map(c => c.content),
        weaknesses: commentsResult.rows.filter(c => c.comment_type === 'weakness').map(c => c.content),
        suggestions: commentsResult.rows.filter(c => c.comment_type === 'suggestion').map(c => c.content),
        highlights: commentsResult.rows.filter(c => c.comment_type === 'highlight').map(c => c.content),
      },
      issues: issuesResult.rows,
    };

    res.json({
      code: 200,
      data: reportData,
      message: '报告生成成功',
    });
  } catch (error) {
    console.error('[POST generate report] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取评估报告预览数据
 * GET /api/expert/evaluations/:evaluationId/report
 */
router.get('/expert/evaluations/:evaluationId/report', async (req, res) => {
  try {
    const { evaluationId } = req.params;

    // 获取评估详情
    const evalResult = await db.query(`
      SELECT
        ea.id,
        ea.project_id,
        ea.expert_id,
        ea.target_id,
        ea.target_type,
        ea.status,
        p.name as project_name,
        p.assessment_type,
        p.start_date,
        p.end_date,
        ps.name as target_name,
        pp.name as expert_name
      FROM expert_assignments ea
      INNER JOIN projects p ON ea.project_id = p.id
      LEFT JOIN project_samples ps ON ea.target_id = ps.id
      LEFT JOIN project_personnel pp ON ea.expert_id = pp.id
      WHERE ea.id = $1
    `, [evaluationId]);

    if (evalResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '评估任务不存在' });
    }

    const evaluation = evalResult.rows[0];

    // 获取评估结论
    const resultQuery = await db.query(`
      SELECT * FROM evaluation_results WHERE assignment_id = $1
    `, [evaluationId]);

    // 获取指标评分（按层级分组）
    const scoresResult = await db.query(`
      SELECT
        iscore.indicator_id,
        iscore.indicator_code,
        i.name as indicator_name,
        i.parent_id,
        i.level,
        iscore.score,
        iscore.score_level,
        iscore.is_compliant,
        iscore.score_basis
      FROM indicator_scores iscore
      INNER JOIN indicators i ON iscore.indicator_id = i.id
      WHERE iscore.assignment_id = $1
      ORDER BY iscore.indicator_code
    `, [evaluationId]);

    // 获取评语
    const commentsResult = await db.query(`
      SELECT id, comment_type, content, priority
      FROM evaluation_comments
      WHERE assignment_id = $1
      ORDER BY comment_type, priority DESC
    `, [evaluationId]);

    // 获取问题台账
    const issuesResult = await db.query(`
      SELECT
        id, issue_code, title, description, severity, status,
        rectification_deadline, rectification_suggestion
      FROM issue_registry
      WHERE evaluation_id = $1
      ORDER BY severity, created_at
    `, [evaluationId]);

    const result = resultQuery.rows[0];

    res.json({
      code: 200,
      data: {
        evaluation: {
          ...evaluation,
          projectName: evaluation.project_name,
          targetName: evaluation.target_name,
          expertName: evaluation.expert_name,
          assessmentType: evaluation.assessment_type,
        },
        conclusion: result ? {
          overallScore: result.overall_score,
          overallLevel: result.overall_level,
          isCompliant: result.is_compliant,
          complianceRate: result.compliance_rate,
          summary: result.summary,
          mainStrengths: result.main_strengths ? JSON.parse(result.main_strengths) : [],
          mainWeaknesses: result.main_weaknesses ? JSON.parse(result.main_weaknesses) : [],
          keySuggestions: result.key_suggestions ? JSON.parse(result.key_suggestions) : [],
          status: result.status,
          submittedAt: result.submitted_at,
        } : null,
        scores: scoresResult.rows,
        scoreStats: {
          total: scoresResult.rows.length,
          compliant: scoresResult.rows.filter(s => s.is_compliant).length,
          distribution: {
            A: scoresResult.rows.filter(s => s.score_level === 'A').length,
            B: scoresResult.rows.filter(s => s.score_level === 'B').length,
            C: scoresResult.rows.filter(s => s.score_level === 'C').length,
            D: scoresResult.rows.filter(s => s.score_level === 'D').length,
          },
        },
        comments: {
          strengths: commentsResult.rows.filter(c => c.comment_type === 'strength'),
          weaknesses: commentsResult.rows.filter(c => c.comment_type === 'weakness'),
          suggestions: commentsResult.rows.filter(c => c.comment_type === 'suggestion'),
          highlights: commentsResult.rows.filter(c => c.comment_type === 'highlight'),
          overall: commentsResult.rows.filter(c => c.comment_type === 'overall'),
        },
        issues: issuesResult.rows,
      },
    });
  } catch (error) {
    console.error('[GET report] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 整改跟踪 API ====================

/**
 * GET /api/my/issues
 * 获取当前用户（被评估对象）的待整改问题
 */
router.get('/my/issues', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { status, projectId } = req.query;

    // 获取用户关联的学校/区县
    const userResult = await db.query(`
      SELECT u.id, u.school_id, u.district_id, s.name as school_name, d.name as district_name
      FROM sys_users u
      LEFT JOIN schools s ON u.school_id = s.id
      LEFT JOIN districts d ON u.district_id = d.id
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    const user = userResult.rows[0];
    const targetId = user.school_id || user.district_id;
    const targetType = user.school_id ? 'school' : 'district';

    if (!targetId) {
      return res.json({
        code: 200,
        data: { issues: [], stats: { total: 0, open: 0, rectifying: 0, resolved: 0 } },
      });
    }

    // 构建查询条件
    let whereClause = 'WHERE ir.target_id = $1';
    const params = [targetId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND ir.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (projectId) {
      whereClause += ` AND ea.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }

    // 查询问题列表
    const issuesResult = await db.query(`
      SELECT
        ir.id,
        ir.issue_code as "issueCode",
        ir.title,
        ir.description,
        ir.severity,
        ir.status,
        ir.rectification_required as "rectificationRequired",
        ir.rectification_deadline as "rectificationDeadline",
        ir.rectification_suggestion as "rectificationSuggestion",
        ir.rectification_evidence as "rectificationEvidence",
        ir.rectified_at as "rectifiedAt",
        ir.review_status as "reviewStatus",
        ir.review_result as "reviewResult",
        ir.review_comment as "reviewComment",
        ir.found_at as "foundAt",
        ir.created_at as "createdAt",
        p.name as "projectName",
        u.name as "expertName"
      FROM issue_registry ir
      JOIN expert_assignments ea ON ir.evaluation_id = ea.id
      JOIN assessment_projects p ON ea.project_id = p.id
      LEFT JOIN sys_users u ON ir.found_by = u.id
      ${whereClause}
      ORDER BY
        CASE ir.status WHEN 'open' THEN 1 WHEN 'rectifying' THEN 2 ELSE 3 END,
        ir.severity DESC,
        ir.created_at DESC
    `, params);

    // 解析 JSON 字段
    const issues = issuesResult.rows.map(row => ({
      ...row,
      rectificationEvidence: row.rectificationEvidence ? JSON.parse(row.rectificationEvidence) : [],
    }));

    // 统计数据
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'rectifying' THEN 1 ELSE 0 END) as rectifying,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
      FROM issue_registry
      WHERE target_id = $1
    `, [targetId]);

    const stats = statsResult.rows[0];

    res.json({
      code: 200,
      data: {
        issues,
        stats: {
          total: parseInt(stats.total) || 0,
          open: parseInt(stats.open) || 0,
          rectifying: parseInt(stats.rectifying) || 0,
          resolved: parseInt(stats.resolved) || 0,
          closed: parseInt(stats.closed) || 0,
        },
        target: {
          id: targetId,
          name: user.school_name || user.district_name,
          type: targetType,
        },
      },
    });
  } catch (error) {
    console.error('[GET my issues] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * GET /api/my/issues/:issueId
 * 获取单个问题详情（被评估对象）
 */
router.get('/my/issues/:issueId', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { issueId } = req.params;

    // 获取用户关联的学校/区县
    const userResult = await db.query(`
      SELECT school_id, district_id FROM sys_users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    const user = userResult.rows[0];
    const targetId = user.school_id || user.district_id;

    // 查询问题详情
    const result = await db.query(`
      SELECT
        ir.id,
        ir.issue_code as "issueCode",
        ir.title,
        ir.description,
        ir.related_indicators as "relatedIndicators",
        ir.severity,
        ir.status,
        ir.rectification_required as "rectificationRequired",
        ir.rectification_deadline as "rectificationDeadline",
        ir.rectification_suggestion as "rectificationSuggestion",
        ir.rectification_evidence as "rectificationEvidence",
        ir.rectified_at as "rectifiedAt",
        ir.review_status as "reviewStatus",
        ir.review_result as "reviewResult",
        ir.review_comment as "reviewComment",
        ir.found_at as "foundAt",
        ir.created_at as "createdAt",
        p.name as "projectName",
        u.name as "expertName",
        ea.target_name as "targetName"
      FROM issue_registry ir
      JOIN expert_assignments ea ON ir.evaluation_id = ea.id
      JOIN assessment_projects p ON ea.project_id = p.id
      LEFT JOIN sys_users u ON ir.found_by = u.id
      WHERE ir.id = $1 AND ir.target_id = $2
    `, [issueId, targetId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '问题不存在或无权访问' });
    }

    const issue = result.rows[0];
    issue.rectificationEvidence = issue.rectificationEvidence ? JSON.parse(issue.rectificationEvidence) : [];
    issue.relatedIndicators = issue.relatedIndicators ? JSON.parse(issue.relatedIndicators) : [];

    res.json({ code: 200, data: issue });
  } catch (error) {
    console.error('[GET my issue detail] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * PUT /api/my/issues/:issueId/rectify
 * 被评估对象提交整改
 */
router.put('/my/issues/:issueId/rectify', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { issueId } = req.params;
    const { evidence, description } = req.body;

    // 获取用户关联的学校/区县
    const userResult = await db.query(`
      SELECT school_id, district_id FROM sys_users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    const user = userResult.rows[0];
    const targetId = user.school_id || user.district_id;

    // 验证问题是否属于该用户
    const issueResult = await db.query(`
      SELECT id, status FROM issue_registry
      WHERE id = $1 AND target_id = $2
    `, [issueId, targetId]);

    if (issueResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '问题不存在或无权操作' });
    }

    const issue = issueResult.rows[0];
    if (issue.status !== 'open' && issue.status !== 'rectifying') {
      return res.status(400).json({ code: 400, message: '该问题状态不允许提交整改' });
    }

    const timestamp = new Date().toISOString();

    // 构建整改证据
    const rectificationEvidence = {
      files: evidence || [],
      description: description || '',
      submittedAt: timestamp,
      submittedBy: userId,
    };

    // 更新问题状态
    await db.query(`
      UPDATE issue_registry SET
        status = 'rectifying',
        rectification_evidence = $1,
        rectified_at = $2,
        updated_at = $2
      WHERE id = $3
    `, [JSON.stringify(rectificationEvidence), timestamp, issueId]);

    res.json({
      code: 200,
      data: { message: '整改材料已提交，等待专家复评' },
    });
  } catch (error) {
    console.error('[PUT my rectify] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 复评验收 API ====================

/**
 * GET /api/expert/pending-reviews
 * 获取待复评的问题列表（专家）
 */
router.get('/expert/pending-reviews', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { projectId } = req.query;

    // 构建查询条件
    let whereClause = 'WHERE ir.found_by = $1 AND ir.status = \'rectifying\'';
    const params = [userId];
    let paramIndex = 2;

    if (projectId) {
      whereClause += ` AND ea.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }

    const result = await db.query(`
      SELECT
        ir.id,
        ir.issue_code as "issueCode",
        ir.title,
        ir.description,
        ir.severity,
        ir.status,
        ir.rectification_deadline as "rectificationDeadline",
        ir.rectification_evidence as "rectificationEvidence",
        ir.rectified_at as "rectifiedAt",
        ea.target_name as "targetName",
        ea.target_type as "targetType",
        p.name as "projectName"
      FROM issue_registry ir
      JOIN expert_assignments ea ON ir.evaluation_id = ea.id
      JOIN assessment_projects p ON ea.project_id = p.id
      ${whereClause}
      ORDER BY ir.rectified_at DESC
    `, params);

    const issues = result.rows.map(row => ({
      ...row,
      rectificationEvidence: row.rectificationEvidence ? JSON.parse(row.rectificationEvidence) : null,
    }));

    res.json({ code: 200, data: issues });
  } catch (error) {
    console.error('[GET pending reviews] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * POST /api/expert/issues/:issueId/review
 * 专家复评问题
 */
router.post('/expert/issues/:issueId/review', async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { issueId } = req.params;
    const { result, comment } = req.body;

    if (!result || !['passed', 'failed'].includes(result)) {
      return res.status(400).json({ code: 400, message: '请提供有效的复评结果' });
    }

    // 验证问题是否由该专家发现
    const issueResult = await db.query(`
      SELECT id, status FROM issue_registry
      WHERE id = $1 AND found_by = $2
    `, [issueId, userId]);

    if (issueResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '问题不存在或无权操作' });
    }

    const issue = issueResult.rows[0];
    if (issue.status !== 'rectifying') {
      return res.status(400).json({ code: 400, message: '该问题状态不允许复评' });
    }

    const timestamp = new Date().toISOString();
    const newStatus = result === 'passed' ? 'resolved' : 'open';

    await db.query(`
      UPDATE issue_registry SET
        status = $1,
        review_status = 'reviewed',
        review_result = $2,
        review_comment = $3,
        reviewed_by = $4,
        reviewed_at = $5,
        updated_at = $5
      WHERE id = $6
    `, [newStatus, result, comment || null, userId, timestamp, issueId]);

    res.json({
      code: 200,
      data: {
        message: result === 'passed' ? '整改通过，问题已解决' : '整改未通过，已打回重新整改',
        newStatus,
      },
    });
  } catch (error) {
    console.error('[POST review] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 多专家协同 API ====================

/**
 * GET /api/projects/:projectId/evaluations/summary
 * 获取项目评估汇总（按评估对象汇总多专家评分）
 */
router.get('/projects/:projectId/evaluations/summary', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取所有评估任务（按目标分组）
    const evaluationsResult = await db.query(`
      SELECT
        ea.target_id as "targetId",
        ea.target_name as "targetName",
        ea.target_type as "targetType",
        COUNT(DISTINCT ea.id) as "expertCount",
        COUNT(DISTINCT CASE WHEN ea.status = 'submitted' THEN ea.id END) as "submittedCount",
        ARRAY_AGG(DISTINCT u.name) as "expertNames",
        ARRAY_AGG(
          json_build_object(
            'id', ea.id,
            'expertId', ea.expert_id,
            'expertName', u.name,
            'status', ea.status,
            'submittedAt', er.submitted_at,
            'overallScore', er.overall_score,
            'overallLevel', er.overall_level,
            'isCompliant', er.is_compliant
          )
        ) as "evaluations"
      FROM expert_assignments ea
      LEFT JOIN sys_users u ON ea.expert_id = u.id
      LEFT JOIN evaluation_results er ON ea.id = er.evaluation_id
      WHERE ea.project_id = $1
      GROUP BY ea.target_id, ea.target_name, ea.target_type
      ORDER BY ea.target_name
    `, [projectId]);

    // 计算汇总统计
    const targets = evaluationsResult.rows.map(row => {
      const evaluations = row.evaluations.filter(e => e.id !== null);
      const submittedEvaluations = evaluations.filter(e => e.status === 'submitted' && e.overallScore !== null);

      // 计算平均分
      let avgScore = null;
      let avgLevel = null;
      if (submittedEvaluations.length > 0) {
        avgScore = submittedEvaluations.reduce((sum, e) => sum + (e.overallScore || 0), 0) / submittedEvaluations.length;
        // 根据平均分计算等级
        if (avgScore >= 90) avgLevel = 'A';
        else if (avgScore >= 75) avgLevel = 'B';
        else if (avgScore >= 60) avgLevel = 'C';
        else avgLevel = 'D';
      }

      return {
        targetId: row.targetId,
        targetName: row.targetName,
        targetType: row.targetType,
        expertCount: parseInt(row.expertCount),
        submittedCount: parseInt(row.submittedCount),
        expertNames: row.expertNames.filter(n => n !== null),
        evaluations: evaluations,
        aggregated: submittedEvaluations.length > 0 ? {
          avgScore: Math.round(avgScore * 10) / 10,
          avgLevel,
          submittedCount: submittedEvaluations.length,
          isConsistent: submittedEvaluations.every(e => e.overallLevel === submittedEvaluations[0]?.overallLevel),
          minScore: Math.min(...submittedEvaluations.map(e => e.overallScore)),
          maxScore: Math.max(...submittedEvaluations.map(e => e.overallScore)),
        } : null,
      };
    });

    res.json({
      code: 200,
      data: {
        projectId,
        targets,
        summary: {
          totalTargets: targets.length,
          fullyEvaluated: targets.filter(t => t.submittedCount === t.expertCount).length,
          partiallyEvaluated: targets.filter(t => t.submittedCount > 0 && t.submittedCount < t.expertCount).length,
          notStarted: targets.filter(t => t.submittedCount === 0).length,
        },
      },
    });
  } catch (error) {
    console.error('[GET evaluations summary] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * GET /api/projects/:projectId/targets/:targetId/evaluations
 * 获取某个评估对象的所有专家评估详情
 */
router.get('/projects/:projectId/targets/:targetId/evaluations', async (req, res) => {
  try {
    const { projectId, targetId } = req.params;

    // 获取所有专家的评估
    const evaluationsResult = await db.query(`
      SELECT
        ea.id as "evaluationId",
        ea.expert_id as "expertId",
        u.name as "expertName",
        ea.status,
        ea.target_name as "targetName",
        ea.target_type as "targetType",
        er.overall_score as "overallScore",
        er.overall_level as "overallLevel",
        er.is_compliant as "isCompliant",
        er.compliance_rate as "complianceRate",
        er.submitted_at as "submittedAt"
      FROM expert_assignments ea
      LEFT JOIN sys_users u ON ea.expert_id = u.id
      LEFT JOIN evaluation_results er ON ea.id = er.evaluation_id
      WHERE ea.project_id = $1 AND ea.target_id = $2
      ORDER BY ea.created_at
    `, [projectId, targetId]);

    if (evaluationsResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '未找到评估任务' });
    }

    // 获取每个专家的评分详情
    const evaluationsWithScores = await Promise.all(
      evaluationsResult.rows.map(async (evaluation) => {
        if (evaluation.status !== 'submitted') {
          return { ...evaluation, scores: [] };
        }

        const scoresResult = await db.query(`
          SELECT
            indicator_id as "indicatorId",
            indicator_code as "indicatorCode",
            score,
            score_level as "scoreLevel",
            is_compliant as "isCompliant"
          FROM indicator_scores
          WHERE evaluation_id = $1
        `, [evaluation.evaluationId]);

        return { ...evaluation, scores: scoresResult.rows };
      })
    );

    // 计算汇总数据
    const submittedEvaluations = evaluationsWithScores.filter(e => e.status === 'submitted' && e.overallScore !== null);
    let aggregated = null;

    if (submittedEvaluations.length > 0) {
      const avgScore = submittedEvaluations.reduce((sum, e) => sum + e.overallScore, 0) / submittedEvaluations.length;
      let avgLevel = 'D';
      if (avgScore >= 90) avgLevel = 'A';
      else if (avgScore >= 75) avgLevel = 'B';
      else if (avgScore >= 60) avgLevel = 'C';

      // 计算每个指标的平均分
      const allIndicatorIds = new Set();
      submittedEvaluations.forEach(e => e.scores.forEach(s => allIndicatorIds.add(s.indicatorId)));

      const indicatorAverages = Array.from(allIndicatorIds).map(indicatorId => {
        const indicatorScores = submittedEvaluations
          .flatMap(e => e.scores)
          .filter(s => s.indicatorId === indicatorId);

        const firstScore = indicatorScores[0];
        const avgIndicatorScore = indicatorScores.reduce((sum, s) => sum + s.score, 0) / indicatorScores.length;

        return {
          indicatorId,
          indicatorCode: firstScore?.indicatorCode,
          avgScore: Math.round(avgIndicatorScore * 10) / 10,
          scores: indicatorScores.map(s => s.score),
          variance: indicatorScores.length > 1
            ? Math.sqrt(indicatorScores.reduce((sum, s) => sum + Math.pow(s.score - avgIndicatorScore, 2), 0) / indicatorScores.length)
            : 0,
        };
      });

      aggregated = {
        avgScore: Math.round(avgScore * 10) / 10,
        avgLevel,
        expertCount: submittedEvaluations.length,
        isConsistent: submittedEvaluations.every(e => e.overallLevel === submittedEvaluations[0]?.overallLevel),
        minScore: Math.min(...submittedEvaluations.map(e => e.overallScore)),
        maxScore: Math.max(...submittedEvaluations.map(e => e.overallScore)),
        indicatorAverages,
      };
    }

    res.json({
      code: 200,
      data: {
        targetId,
        targetName: evaluationsResult.rows[0].targetName,
        targetType: evaluationsResult.rows[0].targetType,
        evaluations: evaluationsWithScores,
        aggregated,
      },
    });
  } catch (error) {
    console.error('[GET target evaluations] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * GET /api/projects/:projectId/experts/workload
 * 获取项目专家工作量统计
 */
router.get('/projects/:projectId/experts/workload', async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(`
      SELECT
        ea.expert_id as "expertId",
        u.name as "expertName",
        COUNT(*) as "totalAssigned",
        SUM(CASE WHEN ea.status = 'pending' THEN 1 ELSE 0 END) as "pending",
        SUM(CASE WHEN ea.status = 'in_progress' THEN 1 ELSE 0 END) as "inProgress",
        SUM(CASE WHEN ea.status = 'submitted' THEN 1 ELSE 0 END) as "submitted",
        AVG(CASE WHEN er.overall_score IS NOT NULL THEN er.overall_score END) as "avgScore"
      FROM expert_assignments ea
      LEFT JOIN sys_users u ON ea.expert_id = u.id
      LEFT JOIN evaluation_results er ON ea.id = er.evaluation_id
      WHERE ea.project_id = $1
      GROUP BY ea.expert_id, u.name
      ORDER BY u.name
    `, [projectId]);

    const experts = result.rows.map(row => ({
      expertId: row.expertId,
      expertName: row.expertName,
      totalAssigned: parseInt(row.totalAssigned),
      pending: parseInt(row.pending),
      inProgress: parseInt(row.inProgress),
      submitted: parseInt(row.submitted),
      completionRate: Math.round((parseInt(row.submitted) / parseInt(row.totalAssigned)) * 100),
      avgScore: row.avgScore ? Math.round(row.avgScore * 10) / 10 : null,
    }));

    res.json({
      code: 200,
      data: {
        projectId,
        experts,
        summary: {
          totalExperts: experts.length,
          fullyCompleted: experts.filter(e => e.completionRate === 100).length,
          avgCompletionRate: Math.round(experts.reduce((sum, e) => sum + e.completionRate, 0) / experts.length),
        },
      },
    });
  } catch (error) {
    console.error('[GET experts workload] 错误:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
module.exports.setDb = setDb;
