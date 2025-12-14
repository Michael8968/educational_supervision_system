/**
 * 规则评估服务
 * 提供规则条件解析、阈值比较、规则执行等核心功能
 */

/**
 * 条件操作符映射
 */
const OPERATORS = {
  equals: (a, b) => a === b,
  not_equals: (a, b) => a !== b,
  in: (a, b) => Array.isArray(b) ? b.includes(a) : false,
  not_in: (a, b) => Array.isArray(b) ? !b.includes(a) : true,
  greater_than: (a, b) => Number(a) > Number(b),
  less_than: (a, b) => Number(a) < Number(b),
  greater_equal: (a, b) => Number(a) >= Number(b),
  less_equal: (a, b) => Number(a) <= Number(b),
  between: (a, b) => {
    if (!Array.isArray(b) || b.length !== 2) return false;
    const num = Number(a);
    return num >= Number(b[0]) && num <= Number(b[1]);
  },
  is_null: (a) => a === null || a === undefined || a === '',
  is_not_null: (a) => a !== null && a !== undefined && a !== ''
};

/**
 * 阈值比较操作符映射
 */
const THRESHOLD_OPERATORS = {
  '>=': (v, t) => v >= t,
  '>': (v, t) => v > t,
  '<=': (v, t) => v <= t,
  '<': (v, t) => v < t,
  '==': (v, t) => v === t,
  '!=': (v, t) => v !== t,
  'between': (v, t) => {
    if (!Array.isArray(t) || t.length !== 2) return false;
    return v >= t[0] && v <= t[1];
  }
};

/**
 * 解析条件值（可能是JSON字符串）
 * @param {string} value - 条件值
 * @returns {any} 解析后的值
 */
function parseConditionValue(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * 获取实体属性值（支持嵌套属性）
 * @param {object} entity - 实体对象
 * @param {string} field - 字段路径，如 "school.type" 或 "institutionType"
 * @returns {any} 字段值
 */
function getFieldValue(entity, field) {
  if (!entity || !field) return undefined;

  const parts = field.split('.');
  let value = entity;

  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }

  return value;
}

/**
 * 解析并评估单个条件
 * @param {object} condition - 条件对象 { field, operator, value }
 * @param {object} entity - 实体对象
 * @returns {boolean} 条件是否满足
 */
function parseCondition(condition, entity) {
  const { field, operator, value } = condition;

  const fieldValue = getFieldValue(entity, field);
  const conditionValue = parseConditionValue(value);

  const operatorFn = OPERATORS[operator];
  if (!operatorFn) {
    console.warn(`Unknown operator: ${operator}`);
    return false;
  }

  return operatorFn(fieldValue, conditionValue);
}

/**
 * 评估多个条件
 * @param {Array} conditions - 条件数组
 * @param {object} entity - 实体对象
 * @returns {boolean} 所有条件是否满足
 */
function evaluateConditions(conditions, entity) {
  if (!conditions || conditions.length === 0) {
    return true; // 无条件时默认通过
  }

  // 按逻辑操作符分组
  let result = parseCondition(conditions[0], entity);

  for (let i = 1; i < conditions.length; i++) {
    const condition = conditions[i];
    const conditionResult = parseCondition(condition, entity);
    const logicalOp = condition.logicalOperator || 'AND';

    if (logicalOp === 'OR') {
      result = result || conditionResult;
    } else {
      result = result && conditionResult;
    }
  }

  return result;
}

/**
 * 比较阈值
 * @param {number} value - 实际值
 * @param {string} operator - 比较操作符
 * @param {number|number[]} threshold - 阈值（between时为数组）
 * @returns {boolean} 是否达标
 */
function compareThreshold(value, operator, threshold) {
  if (value === null || value === undefined || isNaN(value)) {
    return null;
  }

  const numValue = Number(value);
  const operatorFn = THRESHOLD_OPERATORS[operator];

  if (!operatorFn) {
    console.warn(`Unknown threshold operator: ${operator}`);
    return null;
  }

  if (operator === 'between') {
    return operatorFn(numValue, threshold);
  }

  return operatorFn(numValue, Number(threshold));
}

/**
 * 获取动态阈值值
 * @param {object} db - 数据库实例
 * @param {object} thresholdConfig - 阈值配置
 * @param {object} context - 上下文（包含entity, project等）
 * @returns {number|null} 阈值
 */
function resolveDynamicThreshold(db, thresholdConfig, context) {
  const { valueType, value, elementId, formula } = thresholdConfig;

  if (valueType === 'fixed') {
    return Number(value);
  }

  if (valueType === 'element' && elementId) {
    // 从要素获取值
    const element = db.prepare(`
      SELECT id, data_type, formula FROM elements WHERE id = ?
    `).get(elementId);

    if (element) {
      // 如果是派生要素，需要计算公式
      // 这里简化处理，实际可能需要更复杂的公式解析
      // 从element_values表获取值
      const elementValue = db.prepare(`
        SELECT value FROM element_values
        WHERE element_id = ? AND entity_id = ?
        ORDER BY created_at DESC LIMIT 1
      `).get(elementId, context.entity?.id);

      return elementValue ? Number(elementValue.value) : null;
    }
  }

  if (valueType === 'formula' && formula) {
    // 简单公式解析（支持基本运算）
    // 实际生产环境需要更安全的表达式解析器
    try {
      // 替换变量
      let expr = formula;
      const varRegex = /\$\{(\w+)\}/g;
      expr = expr.replace(varRegex, (_, varName) => {
        return context.variables?.[varName] ?? 0;
      });
      // 仅允许数字和基本运算符
      if (/^[\d\s+\-*/().]+$/.test(expr)) {
        return eval(expr);
      }
    } catch (e) {
      console.warn('Formula evaluation error:', e);
    }
  }

  return null;
}

/**
 * 执行单个规则
 * @param {object} db - 数据库实例
 * @param {object} rule - 规则对象（包含conditions和actions）
 * @param {object} entity - 被评估实体
 * @param {object} context - 上下文信息
 * @returns {object} 评估结果
 */
function executeRule(db, rule, entity, context = {}) {
  const result = {
    ruleId: rule.id,
    ruleCode: rule.code,
    ruleName: rule.name,
    entityId: entity.id,
    entityType: context.entityType || 'school',
    applicable: false,
    isCompliant: null,
    actualValue: null,
    thresholdValue: null,
    message: '',
    details: {}
  };

  // 1. 评估条件 - 判断规则是否适用
  const conditions = rule.conditions || [];
  result.applicable = evaluateConditions(conditions, entity);

  if (!result.applicable) {
    result.message = '规则不适用于此实体';
    return result;
  }

  // 2. 执行动作
  const actions = rule.actions || [];

  for (const action of actions) {
    const config = typeof action.config === 'string'
      ? JSON.parse(action.config)
      : action.config;

    if (action.actionType === 'compare' && config.threshold) {
      // 阈值比较
      const valueField = config.valueField || 'value';
      result.actualValue = getFieldValue(entity, valueField);

      // 解析阈值
      result.thresholdValue = resolveDynamicThreshold(db, config.threshold, {
        entity,
        ...context
      }) ?? config.threshold.value;

      result.isCompliant = compareThreshold(
        result.actualValue,
        config.threshold.operator,
        result.thresholdValue
      );

      if (result.isCompliant === true) {
        result.message = action.passMessage || '达标';
      } else if (result.isCompliant === false) {
        result.message = action.failMessage || '未达标';
      } else {
        result.message = '无法判定（数据缺失）';
      }

      result.details = {
        operator: config.threshold.operator,
        valueType: config.threshold.valueType
      };
    }

    if (action.actionType === 'validate') {
      // 数据校验（在validationService中处理）
      result.details.validationType = config.validation?.type;
    }

    if (action.actionType === 'aggregate') {
      // 聚合计算（在aggregationService中处理）
      result.details.aggregation = config.aggregation;
    }
  }

  return result;
}

/**
 * 批量评估规则
 * @param {object} db - 数据库实例
 * @param {string} ruleId - 规则ID
 * @param {Array} entities - 实体数组
 * @param {object} context - 上下文信息
 * @returns {Array} 评估结果数组
 */
function batchEvaluate(db, ruleId, entities, context = {}) {
  // 获取规则及其条件和动作
  const rule = db.prepare(`
    SELECT id, code, name, rule_type as ruleType, indicator_id as indicatorId,
           element_id as elementId, enabled, priority
    FROM compliance_rules WHERE id = ? AND enabled = 1
  `).get(ruleId);

  if (!rule) {
    return [];
  }

  // 获取规则条件
  rule.conditions = db.prepare(`
    SELECT id, field, operator, value, logical_operator as logicalOperator
    FROM rule_conditions WHERE rule_id = ? ORDER BY sort_order
  `).all(ruleId);

  // 获取规则动作
  rule.actions = db.prepare(`
    SELECT id, action_type as actionType, config, result_field as resultField,
           pass_message as passMessage, fail_message as failMessage
    FROM rule_actions WHERE rule_id = ? ORDER BY sort_order
  `).all(ruleId);

  // 批量执行
  const results = [];
  for (const entity of entities) {
    const result = executeRule(db, rule, entity, context);
    results.push(result);
  }

  return results;
}

/**
 * 评估项目的所有规则
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {object} options - 选项
 * @returns {object} 评估结果汇总
 */
function evaluateProject(db, projectId, options = {}) {
  const { schoolId, indicatorId, ruleType } = options;

  // 获取适用的规则
  let ruleQuery = `
    SELECT id, code, name, rule_type as ruleType, indicator_id as indicatorId,
           element_id as elementId, enabled, priority
    FROM compliance_rules WHERE enabled = 1
  `;
  const ruleParams = [];

  if (indicatorId) {
    ruleQuery += ' AND indicator_id = ?';
    ruleParams.push(indicatorId);
  }

  if (ruleType) {
    ruleQuery += ' AND rule_type = ?';
    ruleParams.push(ruleType);
  }

  ruleQuery += ' ORDER BY priority DESC';

  const rules = db.prepare(ruleQuery).all(...ruleParams);

  // 获取学校列表
  let schoolQuery = `
    SELECT s.id, s.name, s.code, s.school_type as schoolType,
           s.student_count as studentCount, s.teacher_count as teacherCount,
           s.district_id as districtId
    FROM schools s
    WHERE s.status = 'active'
  `;
  const schoolParams = [];

  if (schoolId) {
    schoolQuery += ' AND s.id = ?';
    schoolParams.push(schoolId);
  }

  const schools = db.prepare(schoolQuery).all(...schoolParams);

  // 为每个学校加载填报数据
  const loadSchoolData = (school) => {
    const indicatorData = db.prepare(`
      SELECT di.id as indicatorId, di.code, di.name,
             sid.value, sid.text_value as textValue
      FROM school_indicator_data sid
      JOIN data_indicators di ON sid.data_indicator_id = di.id
      WHERE sid.project_id = ? AND sid.school_id = ?
    `).all(projectId, school.id);

    const dataMap = {};
    indicatorData.forEach(d => {
      dataMap[d.code] = d.value;
      dataMap[`${d.code}_text`] = d.textValue;
    });

    return { ...school, data: dataMap };
  };

  const enrichedSchools = schools.map(loadSchoolData);

  // 执行评估
  const allResults = [];
  const timestamp = new Date().toISOString();

  for (const rule of rules) {
    // 加载规则条件和动作
    rule.conditions = db.prepare(`
      SELECT id, field, operator, value, logical_operator as logicalOperator
      FROM rule_conditions WHERE rule_id = ? ORDER BY sort_order
    `).all(rule.id);

    rule.actions = db.prepare(`
      SELECT id, action_type as actionType, config, result_field as resultField,
             pass_message as passMessage, fail_message as failMessage
      FROM rule_actions WHERE rule_id = ? ORDER BY sort_order
    `).all(rule.id);

    for (const school of enrichedSchools) {
      const result = executeRule(db, rule, school, {
        projectId,
        entityType: 'school'
      });

      if (result.applicable) {
        allResults.push({
          ...result,
          projectId,
          calculatedAt: timestamp
        });
      }
    }
  }

  // 汇总统计
  const summary = {
    totalRules: rules.length,
    totalSchools: schools.length,
    totalEvaluations: allResults.length,
    compliantCount: allResults.filter(r => r.isCompliant === true).length,
    nonCompliantCount: allResults.filter(r => r.isCompliant === false).length,
    pendingCount: allResults.filter(r => r.isCompliant === null).length,
    complianceRate: 0
  };

  if (summary.compliantCount + summary.nonCompliantCount > 0) {
    summary.complianceRate = Math.round(
      (summary.compliantCount / (summary.compliantCount + summary.nonCompliantCount)) * 10000
    ) / 100;
  }

  return {
    summary,
    results: allResults
  };
}

/**
 * 保存评估结果到数据库
 * @param {object} db - 数据库实例
 * @param {Array} results - 评估结果数组
 * @param {string} projectId - 项目ID
 */
function saveResults(db, results, projectId) {
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  const timestamp = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO compliance_results
    (id, project_id, rule_id, entity_type, entity_id, indicator_id,
     actual_value, threshold_value, is_compliant, message, details, calculated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    // 清除旧结果
    db.prepare('DELETE FROM compliance_results WHERE project_id = ?').run(projectId);

    // 插入新结果
    for (const result of results) {
      insert.run(
        generateId(),
        projectId,
        result.ruleId,
        result.entityType,
        result.entityId,
        result.indicatorId || null,
        result.actualValue !== null ? String(result.actualValue) : null,
        result.thresholdValue !== null ? String(result.thresholdValue) : null,
        result.isCompliant === null ? null : (result.isCompliant ? 1 : 0),
        result.message,
        JSON.stringify(result.details),
        timestamp
      );
    }
  });

  transaction();
}

/**
 * 获取学校的规则映射类型
 * 根据学校类型返回应适用的规则类型
 * @param {string} schoolType - 学校类型
 * @returns {string[]} 适用的规则机构类型
 */
function getApplicableInstitutionTypes(schoolType) {
  const mapping = {
    '小学': ['primary'],
    '初中': ['middle'],
    '九年一贯制': ['primary', 'middle', 'nine_year'],
    '完全中学': ['middle', 'complete'],
    '教学点': ['teaching_point', 'primary']
  };

  return mapping[schoolType] || [];
}

module.exports = {
  OPERATORS,
  THRESHOLD_OPERATORS,
  parseCondition,
  evaluateConditions,
  compareThreshold,
  resolveDynamicThreshold,
  executeRule,
  batchEvaluate,
  evaluateProject,
  saveResults,
  getApplicableInstitutionTypes,
  getFieldValue,
  parseConditionValue
};
