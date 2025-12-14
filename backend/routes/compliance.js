const express = require('express');
const router = express.Router();
const ruleService = require('../services/ruleService');
const validationService = require('../services/validationService');
const aggregationService = require('../services/aggregationService');

// 数据库连接将在index.js中注入
let db = null;

const setDb = (database) => {
  db = database;
};

// 生成UUID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// ==================== 规则 CRUD ====================

// 获取规则列表
router.get('/compliance-rules', (req, res) => {
  try {
    const { ruleType, indicatorId, enabled } = req.query;

    let query = `
      SELECT
        cr.id, cr.code, cr.name, cr.rule_type as ruleType,
        cr.indicator_id as indicatorId, cr.element_id as elementId,
        cr.enabled, cr.priority, cr.description,
        cr.created_by as createdBy, cr.created_at as createdAt,
        cr.updated_by as updatedBy, cr.updated_at as updatedAt,
        di.code as indicatorCode, di.name as indicatorName,
        e.code as elementCode, e.name as elementName
      FROM compliance_rules cr
      LEFT JOIN data_indicators di ON cr.indicator_id = di.id
      LEFT JOIN elements e ON cr.element_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (ruleType) {
      query += ' AND cr.rule_type = ?';
      params.push(ruleType);
    }

    if (indicatorId) {
      query += ' AND cr.indicator_id = ?';
      params.push(indicatorId);
    }

    if (enabled !== undefined) {
      query += ' AND cr.enabled = ?';
      params.push(enabled === 'true' || enabled === '1' ? 1 : 0);
    }

    query += ' ORDER BY cr.priority DESC, cr.created_at DESC';

    const rules = db.prepare(query).all(...params);

    res.json({ code: 200, data: rules });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个规则详情
router.get('/compliance-rules/:id', (req, res) => {
  try {
    const rule = db.prepare(`
      SELECT
        cr.id, cr.code, cr.name, cr.rule_type as ruleType,
        cr.indicator_id as indicatorId, cr.element_id as elementId,
        cr.enabled, cr.priority, cr.description,
        cr.created_by as createdBy, cr.created_at as createdAt,
        cr.updated_by as updatedBy, cr.updated_at as updatedAt
      FROM compliance_rules cr WHERE cr.id = ?
    `).get(req.params.id);

    if (!rule) {
      return res.status(404).json({ code: 404, message: '规则不存在' });
    }

    // 获取条件
    rule.conditions = db.prepare(`
      SELECT id, field, operator, value, logical_operator as logicalOperator, sort_order as sortOrder
      FROM rule_conditions WHERE rule_id = ? ORDER BY sort_order
    `).all(req.params.id);

    // 解析条件值
    rule.conditions.forEach(c => {
      try {
        c.value = JSON.parse(c.value);
      } catch {
        // 保持原值
      }
    });

    // 获取动作
    rule.actions = db.prepare(`
      SELECT id, action_type as actionType, config, result_field as resultField,
             pass_message as passMessage, fail_message as failMessage, sort_order as sortOrder
      FROM rule_actions WHERE rule_id = ? ORDER BY sort_order
    `).all(req.params.id);

    // 解析配置
    rule.actions.forEach(a => {
      try {
        a.config = JSON.parse(a.config);
      } catch {
        // 保持原值
      }
    });

    res.json({ code: 200, data: rule });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建规则
router.post('/compliance-rules', (req, res) => {
  try {
    const { code, name, ruleType, indicatorId, elementId, enabled, priority, description, conditions, actions } = req.body;

    if (!code || !name || !ruleType) {
      return res.status(400).json({ code: 400, message: '缺少必填字段' });
    }

    const id = generateId();
    const timestamp = now();

    // 检查code唯一性
    const existing = db.prepare('SELECT id FROM compliance_rules WHERE code = ?').get(code);
    if (existing) {
      return res.status(400).json({ code: 400, message: '规则代码已存在' });
    }

    const transaction = db.transaction(() => {
      // 插入规则
      db.prepare(`
        INSERT INTO compliance_rules
        (id, code, name, rule_type, indicator_id, element_id, enabled, priority, description, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?)
      `).run(id, code, name, ruleType, indicatorId || null, elementId || null,
        enabled !== false ? 1 : 0, priority || 0, description || '', timestamp, timestamp);

      // 插入条件
      if (conditions && conditions.length > 0) {
        const insertCondition = db.prepare(`
          INSERT INTO rule_conditions (id, rule_id, field, operator, value, logical_operator, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        conditions.forEach((c, idx) => {
          insertCondition.run(
            generateId(), id, c.field, c.operator,
            typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value),
            c.logicalOperator || 'AND', idx
          );
        });
      }

      // 插入动作
      if (actions && actions.length > 0) {
        const insertAction = db.prepare(`
          INSERT INTO rule_actions (id, rule_id, action_type, config, result_field, pass_message, fail_message, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        actions.forEach((a, idx) => {
          insertAction.run(
            generateId(), id, a.actionType,
            typeof a.config === 'object' ? JSON.stringify(a.config) : a.config,
            a.resultField || null, a.passMessage || null, a.failMessage || null, idx
          );
        });
      }
    });

    transaction();

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新规则
router.put('/compliance-rules/:id', (req, res) => {
  try {
    const { code, name, ruleType, indicatorId, elementId, enabled, priority, description, conditions, actions } = req.body;
    const ruleId = req.params.id;
    const timestamp = now();

    // 检查规则是否存在
    const existing = db.prepare('SELECT id FROM compliance_rules WHERE id = ?').get(ruleId);
    if (!existing) {
      return res.status(404).json({ code: 404, message: '规则不存在' });
    }

    // 检查code唯一性
    if (code) {
      const codeExists = db.prepare('SELECT id FROM compliance_rules WHERE code = ? AND id != ?').get(code, ruleId);
      if (codeExists) {
        return res.status(400).json({ code: 400, message: '规则代码已存在' });
      }
    }

    const transaction = db.transaction(() => {
      // 更新规则
      db.prepare(`
        UPDATE compliance_rules
        SET code = ?, name = ?, rule_type = ?, indicator_id = ?, element_id = ?,
            enabled = ?, priority = ?, description = ?, updated_by = 'admin', updated_at = ?
        WHERE id = ?
      `).run(code, name, ruleType, indicatorId || null, elementId || null,
        enabled !== false ? 1 : 0, priority || 0, description || '', timestamp, ruleId);

      // 更新条件：删除旧的，插入新的
      db.prepare('DELETE FROM rule_conditions WHERE rule_id = ?').run(ruleId);

      if (conditions && conditions.length > 0) {
        const insertCondition = db.prepare(`
          INSERT INTO rule_conditions (id, rule_id, field, operator, value, logical_operator, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        conditions.forEach((c, idx) => {
          insertCondition.run(
            c.id || generateId(), ruleId, c.field, c.operator,
            typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value),
            c.logicalOperator || 'AND', idx
          );
        });
      }

      // 更新动作
      db.prepare('DELETE FROM rule_actions WHERE rule_id = ?').run(ruleId);

      if (actions && actions.length > 0) {
        const insertAction = db.prepare(`
          INSERT INTO rule_actions (id, rule_id, action_type, config, result_field, pass_message, fail_message, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        actions.forEach((a, idx) => {
          insertAction.run(
            a.id || generateId(), ruleId, a.actionType,
            typeof a.config === 'object' ? JSON.stringify(a.config) : a.config,
            a.resultField || null, a.passMessage || null, a.failMessage || null, idx
          );
        });
      }
    });

    transaction();

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除规则
router.delete('/compliance-rules/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM compliance_rules WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '规则不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 切换规则启用状态
router.post('/compliance-rules/:id/toggle', (req, res) => {
  try {
    const rule = db.prepare('SELECT id, enabled FROM compliance_rules WHERE id = ?').get(req.params.id);

    if (!rule) {
      return res.status(404).json({ code: 404, message: '规则不存在' });
    }

    const newEnabled = rule.enabled ? 0 : 1;
    db.prepare('UPDATE compliance_rules SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(newEnabled, now(), req.params.id);

    res.json({ code: 200, data: { enabled: !!newEnabled }, message: newEnabled ? '已启用' : '已禁用' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 测试规则执行
router.post('/compliance-rules/:id/test', (req, res) => {
  try {
    const { entities } = req.body;

    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return res.status(400).json({ code: 400, message: '请提供测试实体数据' });
    }

    const results = ruleService.batchEvaluate(db, req.params.id, entities, {});

    res.json({
      code: 200,
      data: {
        ruleId: req.params.id,
        totalEntities: entities.length,
        results
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 规则执行 ====================

// 执行项目规则评估
router.post('/projects/:projectId/evaluate', (req, res) => {
  try {
    const { schoolId, indicatorId, ruleType, saveResults: shouldSave = true } = req.body;
    const projectId = req.params.projectId;

    // 检查项目是否存在
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    const evaluation = ruleService.evaluateProject(db, projectId, {
      schoolId,
      indicatorId,
      ruleType
    });

    // 保存结果
    if (shouldSave && evaluation.results.length > 0) {
      ruleService.saveResults(db, evaluation.results, projectId);
    }

    res.json({
      code: 200,
      data: evaluation,
      message: `评估完成，共${evaluation.summary.totalEvaluations}项`
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取项目评估结果
router.get('/projects/:projectId/compliance-results', (req, res) => {
  try {
    const { schoolId, indicatorId, isCompliant } = req.query;
    const projectId = req.params.projectId;

    let query = `
      SELECT
        cr.id, cr.rule_id as ruleId, cr.entity_type as entityType, cr.entity_id as entityId,
        cr.indicator_id as indicatorId, cr.actual_value as actualValue,
        cr.threshold_value as thresholdValue, cr.is_compliant as isCompliant,
        cr.message, cr.details, cr.calculated_at as calculatedAt,
        rule.code as ruleCode, rule.name as ruleName,
        s.name as schoolName, s.code as schoolCode,
        di.code as indicatorCode, di.name as indicatorName
      FROM compliance_results cr
      LEFT JOIN compliance_rules rule ON cr.rule_id = rule.id
      LEFT JOIN schools s ON cr.entity_id = s.id AND cr.entity_type = 'school'
      LEFT JOIN data_indicators di ON cr.indicator_id = di.id
      WHERE cr.project_id = ?
    `;
    const params = [projectId];

    if (schoolId) {
      query += ' AND cr.entity_id = ?';
      params.push(schoolId);
    }

    if (indicatorId) {
      query += ' AND cr.indicator_id = ?';
      params.push(indicatorId);
    }

    if (isCompliant !== undefined) {
      query += ' AND cr.is_compliant = ?';
      params.push(isCompliant === 'true' || isCompliant === '1' ? 1 : 0);
    }

    query += ' ORDER BY cr.calculated_at DESC';

    const results = db.prepare(query).all(...params);

    // 解析details
    results.forEach(r => {
      try {
        r.details = JSON.parse(r.details);
      } catch {
        r.details = {};
      }
      r.isCompliant = r.isCompliant === 1 ? true : (r.isCompliant === 0 ? false : null);
    });

    res.json({ code: 200, data: results });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取学校达标汇总
router.get('/schools/:schoolId/compliance-summary', (req, res) => {
  try {
    const { projectId } = req.query;
    const schoolId = req.params.schoolId;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请提供项目ID' });
    }

    // 获取学校信息
    const school = db.prepare(`
      SELECT id, name, code, school_type as schoolType, district_id as districtId
      FROM schools WHERE id = ?
    `).get(schoolId);

    if (!school) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    // 获取达标统计
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
        SUM(CASE WHEN is_compliant = 0 THEN 1 ELSE 0 END) as nonCompliant,
        SUM(CASE WHEN is_compliant IS NULL THEN 1 ELSE 0 END) as pending
      FROM compliance_results
      WHERE project_id = ? AND entity_id = ? AND entity_type = 'school'
    `).get(projectId, schoolId);

    // 获取未达标项目明细
    const nonCompliantItems = db.prepare(`
      SELECT
        cr.id, cr.indicator_id as indicatorId, cr.actual_value as actualValue,
        cr.threshold_value as thresholdValue, cr.message,
        di.code as indicatorCode, di.name as indicatorName
      FROM compliance_results cr
      LEFT JOIN data_indicators di ON cr.indicator_id = di.id
      WHERE cr.project_id = ? AND cr.entity_id = ? AND cr.entity_type = 'school' AND cr.is_compliant = 0
    `).all(projectId, schoolId);

    res.json({
      code: 200,
      data: {
        school,
        summary: {
          total: stats.total || 0,
          compliant: stats.compliant || 0,
          nonCompliant: stats.nonCompliant || 0,
          pending: stats.pending || 0,
          complianceRate: stats.total > 0
            ? Math.round((stats.compliant / (stats.compliant + stats.nonCompliant)) * 10000) / 100
            : null
        },
        nonCompliantItems
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 阈值标准管理 ====================

// 获取阈值标准列表
router.get('/threshold-standards', (req, res) => {
  try {
    const { indicatorId, institutionType } = req.query;

    let query = `
      SELECT
        ts.id, ts.indicator_id as indicatorId, ts.institution_type as institutionType,
        ts.threshold_operator as thresholdOperator, ts.threshold_value as thresholdValue,
        ts.unit, ts.source, ts.effective_date as effectiveDate, ts.expiry_date as expiryDate,
        ts.created_at as createdAt, ts.updated_at as updatedAt,
        di.code as indicatorCode, di.name as indicatorName
      FROM threshold_standards ts
      LEFT JOIN data_indicators di ON ts.indicator_id = di.id
      WHERE 1=1
    `;
    const params = [];

    if (indicatorId) {
      query += ' AND ts.indicator_id = ?';
      params.push(indicatorId);
    }

    if (institutionType) {
      query += ' AND ts.institution_type = ?';
      params.push(institutionType);
    }

    query += ' ORDER BY di.code, ts.institution_type';

    const standards = db.prepare(query).all(...params);

    res.json({ code: 200, data: standards });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 保存阈值标准
router.post('/threshold-standards', (req, res) => {
  try {
    const { indicatorId, institutionType, thresholdOperator, thresholdValue, unit, source, effectiveDate, expiryDate } = req.body;

    if (!indicatorId || !institutionType || !thresholdOperator || thresholdValue === undefined) {
      return res.status(400).json({ code: 400, message: '缺少必填字段' });
    }

    const id = generateId();
    const timestamp = now();

    // 使用UPSERT
    db.prepare(`
      INSERT INTO threshold_standards
      (id, indicator_id, institution_type, threshold_operator, threshold_value, unit, source, effective_date, expiry_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(indicator_id, institution_type) DO UPDATE SET
        threshold_operator = excluded.threshold_operator,
        threshold_value = excluded.threshold_value,
        unit = excluded.unit,
        source = excluded.source,
        effective_date = excluded.effective_date,
        expiry_date = excluded.expiry_date,
        updated_at = excluded.updated_at
    `).run(id, indicatorId, institutionType, thresholdOperator, String(thresholdValue),
      unit || null, source || null, effectiveDate || null, expiryDate || null, timestamp, timestamp);

    res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 数据校验 ====================

// 校验表单数据
router.post('/validate', (req, res) => {
  try {
    const { data, schema, targetType, targetId } = req.body;

    let validationSchema = schema;

    // 如果没有提供schema，从数据库加载
    if (!schema && targetType && targetId) {
      const rules = validationService.loadValidationRules(db, targetType, targetId);
      validationSchema = { [targetId]: rules };
    }

    if (!validationSchema) {
      return res.status(400).json({ code: 400, message: '请提供校验规则' });
    }

    const result = validationService.validateForm(data, validationSchema, { db });

    res.json({
      code: result.valid ? 200 : 400,
      data: {
        valid: result.valid,
        errors: result.errors.map(e => e.toJSON()),
        correctedData: result.correctedData
      },
      message: result.valid ? '校验通过' : '校验失败'
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 聚合计算 ====================

// 计算区县差异系数
router.get('/districts/:districtId/cv', (req, res) => {
  try {
    const { projectId, indicatorId, schoolType } = req.query;
    const districtId = req.params.districtId;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请提供项目ID' });
    }

    if (indicatorId) {
      // 单指标差异系数
      const result = aggregationService.calculateDistrictCV(db, projectId, districtId, indicatorId, { schoolType });
      res.json({ code: 200, data: result });
    } else {
      // 综合差异系数（需要获取所有核心指标）
      const coreIndicators = db.prepare(`
        SELECT di.id FROM data_indicators di
        JOIN indicators i ON di.indicator_id = i.id
        WHERE i.level = 2
      `).all().map(r => r.id);

      const result = aggregationService.calculateCompositeCV(db, projectId, districtId, coreIndicators, { schoolType });
      res.json({ code: 200, data: result });
    }
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取区县达标率统计
router.get('/districts/:districtId/compliance-rate', (req, res) => {
  try {
    const { projectId, indicatorId, schoolType } = req.query;
    const districtId = req.params.districtId;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请提供项目ID' });
    }

    const result = aggregationService.calculateDistrictComplianceRate(db, projectId, districtId, {
      indicatorId,
      schoolType
    });

    res.json({ code: 200, data: result });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 生成区县统计报表
router.get('/districts/:districtId/report', (req, res) => {
  try {
    const { projectId } = req.query;
    const districtId = req.params.districtId;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请提供项目ID' });
    }

    const report = aggregationService.generateDistrictReport(db, projectId, districtId);

    if (!report) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    res.json({ code: 200, data: report });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
