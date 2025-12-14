/**
 * 聚合计算服务
 * 提供SUM、AVG、COUNT等聚合函数及差异系数计算
 */

const { calculateCV } = require('./statisticsService');

/**
 * 聚合函数类型
 */
const AGGREGATE_FUNCTIONS = {
  SUM: 'SUM',
  AVG: 'AVG',
  COUNT: 'COUNT',
  MIN: 'MIN',
  MAX: 'MAX',
  STDDEV: 'STDDEV',
  CV: 'CV'         // 差异系数
};

/**
 * 计算SUM
 * @param {number[]} values - 数值数组
 * @returns {number|null}
 */
function sum(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => Number(a) + Number(b), 0);
}

/**
 * 计算AVG
 * @param {number[]} values - 数值数组
 * @returns {number|null}
 */
function avg(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) return null;
  const total = valid.reduce((a, b) => Number(a) + Number(b), 0);
  return total / valid.length;
}

/**
 * 计算COUNT
 * @param {any[]} values - 值数组
 * @param {object} options - 选项 { countNull: false }
 * @returns {number}
 */
function count(values, options = {}) {
  if (options.countNull) {
    return values.length;
  }
  return values.filter(v => v !== null && v !== undefined).length;
}

/**
 * 计算MIN
 * @param {number[]} values - 数值数组
 * @returns {number|null}
 */
function min(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v)).map(Number);
  if (valid.length === 0) return null;
  return Math.min(...valid);
}

/**
 * 计算MAX
 * @param {number[]} values - 数值数组
 * @returns {number|null}
 */
function max(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v)).map(Number);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

/**
 * 计算标准差
 * @param {number[]} values - 数值数组
 * @param {boolean} population - 是否是总体标准差
 * @returns {number|null}
 */
function stddev(values, population = true) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v)).map(Number);
  if (valid.length === 0) return null;

  const n = valid.length;
  const mean = valid.reduce((a, b) => a + b, 0) / n;
  const squaredDiffs = valid.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / (population ? n : n - 1);

  return Math.sqrt(avgSquaredDiff);
}

/**
 * 计算差异系数 (Coefficient of Variation)
 * @param {number[]} values - 数值数组
 * @returns {object|null} { cv, mean, stdDev, count }
 */
function cv(values) {
  return calculateCV(values);
}

/**
 * 执行聚合函数
 * @param {string} func - 函数名
 * @param {number[]} values - 数值数组
 * @param {object} options - 选项
 * @returns {any} 计算结果
 */
function executeAggregateFunction(func, values, options = {}) {
  switch (func.toUpperCase()) {
    case AGGREGATE_FUNCTIONS.SUM:
      return sum(values);
    case AGGREGATE_FUNCTIONS.AVG:
      return avg(values);
    case AGGREGATE_FUNCTIONS.COUNT:
      return count(values, options);
    case AGGREGATE_FUNCTIONS.MIN:
      return min(values);
    case AGGREGATE_FUNCTIONS.MAX:
      return max(values);
    case AGGREGATE_FUNCTIONS.STDDEV:
      return stddev(values, options.population !== false);
    case AGGREGATE_FUNCTIONS.CV:
      return cv(values);
    default:
      console.warn(`Unknown aggregate function: ${func}`);
      return null;
  }
}

/**
 * 按分组计算聚合
 * @param {Array} data - 数据数组
 * @param {object} config - 配置 { valueField, groupBy, function, filter }
 * @returns {object} 分组结果
 */
function aggregateByGroup(data, config) {
  const { valueField, groupBy = [], aggregateFunction, filter } = config;

  // 应用过滤条件
  let filteredData = data;
  if (filter && typeof filter === 'function') {
    filteredData = data.filter(filter);
  }

  // 如果没有分组，直接计算整体
  if (!groupBy || groupBy.length === 0) {
    const values = filteredData.map(d => d[valueField]);
    return {
      _all: {
        value: executeAggregateFunction(aggregateFunction, values),
        count: filteredData.length
      }
    };
  }

  // 按分组键聚合
  const groups = {};

  for (const item of filteredData) {
    // 构建分组键
    const keyParts = groupBy.map(field => item[field] ?? 'null');
    const key = keyParts.join('|');

    if (!groups[key]) {
      groups[key] = {
        groupValues: {},
        values: []
      };
      groupBy.forEach((field, i) => {
        groups[key].groupValues[field] = keyParts[i];
      });
    }

    groups[key].values.push(item[valueField]);
  }

  // 计算每组的聚合值
  const result = {};
  for (const [key, group] of Object.entries(groups)) {
    result[key] = {
      ...group.groupValues,
      value: executeAggregateFunction(aggregateFunction, group.values),
      count: group.values.length
    };
  }

  return result;
}

/**
 * 计算区县级指标达标率
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {string} districtId - 区县ID
 * @param {object} options - 选项
 * @returns {object} 达标率统计
 */
function calculateDistrictComplianceRate(db, projectId, districtId, options = {}) {
  const { indicatorId, schoolType } = options;

  let query = `
    SELECT
      cr.indicator_id,
      di.code as indicatorCode,
      di.name as indicatorName,
      COUNT(*) as total,
      SUM(CASE WHEN cr.is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
      SUM(CASE WHEN cr.is_compliant = 0 THEN 1 ELSE 0 END) as nonCompliant
    FROM compliance_results cr
    JOIN schools s ON cr.entity_id = s.id AND cr.entity_type = 'school'
    LEFT JOIN data_indicators di ON cr.indicator_id = di.id
    WHERE cr.project_id = ? AND s.district_id = ?
  `;
  const params = [projectId, districtId];

  if (indicatorId) {
    query += ' AND cr.indicator_id = ?';
    params.push(indicatorId);
  }

  if (schoolType) {
    query += ' AND s.school_type = ?';
    params.push(schoolType);
  }

  query += ' GROUP BY cr.indicator_id';

  try {
    const results = db.prepare(query).all(...params);

    const indicators = results.map(r => ({
      indicatorId: r.indicator_id,
      indicatorCode: r.indicatorCode,
      indicatorName: r.indicatorName,
      total: r.total,
      compliant: r.compliant,
      nonCompliant: r.nonCompliant,
      complianceRate: r.total > 0
        ? Math.round((r.compliant / r.total) * 10000) / 100
        : null
    }));

    // 汇总
    const summary = {
      totalIndicators: indicators.length,
      totalEvaluations: indicators.reduce((sum, i) => sum + i.total, 0),
      totalCompliant: indicators.reduce((sum, i) => sum + i.compliant, 0),
      totalNonCompliant: indicators.reduce((sum, i) => sum + i.nonCompliant, 0)
    };
    summary.overallComplianceRate = summary.totalEvaluations > 0
      ? Math.round((summary.totalCompliant / summary.totalEvaluations) * 10000) / 100
      : null;

    return {
      districtId,
      summary,
      indicators
    };
  } catch (e) {
    console.error('Calculate district compliance rate error:', e);
    return null;
  }
}

/**
 * 计算区县级差异系数
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {string} districtId - 区县ID
 * @param {string} indicatorId - 数据指标ID
 * @param {object} options - 选项
 * @returns {object} 差异系数结果
 */
function calculateDistrictCV(db, projectId, districtId, indicatorId, options = {}) {
  const { schoolType } = options;

  let query = `
    SELECT
      sid.value,
      s.id as schoolId,
      s.name as schoolName,
      s.school_type as schoolType
    FROM school_indicator_data sid
    JOIN schools s ON sid.school_id = s.id
    WHERE sid.project_id = ? AND s.district_id = ? AND sid.data_indicator_id = ?
    AND sid.value IS NOT NULL
  `;
  const params = [projectId, districtId, indicatorId];

  if (schoolType) {
    if (schoolType === '小学') {
      query += " AND (s.school_type = '小学' OR s.school_type = '九年一贯制')";
    } else if (schoolType === '初中') {
      query += " AND (s.school_type = '初中' OR s.school_type = '九年一贯制' OR s.school_type = '完全中学')";
    } else {
      query += ' AND s.school_type = ?';
      params.push(schoolType);
    }
  }

  try {
    const rows = db.prepare(query).all(...params);
    const values = rows.map(r => Number(r.value)).filter(v => !isNaN(v));

    if (values.length === 0) {
      return {
        districtId,
        indicatorId,
        schoolCount: 0,
        cv: null,
        mean: null,
        stdDev: null,
        isCompliant: null,
        threshold: options.cvThreshold || 0.65
      };
    }

    const cvResult = calculateCV(values);
    const threshold = options.cvThreshold || 0.65;

    return {
      districtId,
      indicatorId,
      schoolCount: values.length,
      cv: cvResult?.cv,
      mean: cvResult?.mean,
      stdDev: cvResult?.stdDev,
      isCompliant: cvResult?.cv !== null ? cvResult.cv <= threshold : null,
      threshold,
      schools: rows.map(r => ({
        schoolId: r.schoolId,
        schoolName: r.schoolName,
        value: Number(r.value)
      }))
    };
  } catch (e) {
    console.error('Calculate district CV error:', e);
    return null;
  }
}

/**
 * 计算综合差异系数
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {string} districtId - 区县ID
 * @param {string[]} indicatorIds - 数据指标ID数组
 * @param {object} options - 选项
 * @returns {object} 综合差异系数结果
 */
function calculateCompositeCV(db, projectId, districtId, indicatorIds, options = {}) {
  const { schoolType } = options;

  const indicatorResults = [];
  let validCvCount = 0;
  let cvSum = 0;

  for (const indicatorId of indicatorIds) {
    const result = calculateDistrictCV(db, projectId, districtId, indicatorId, {
      schoolType,
      cvThreshold: 0.65
    });

    if (result) {
      indicatorResults.push(result);
      if (result.cv !== null) {
        cvSum += result.cv;
        validCvCount++;
      }
    }
  }

  // 综合差异系数 = 各指标差异系数的平均值
  const compositeCV = validCvCount > 0 ? cvSum / validCvCount : null;

  // 综合差异系数阈值
  const threshold = schoolType === '小学' ? 0.50 : (schoolType === '初中' ? 0.45 : 0.50);

  return {
    districtId,
    schoolType,
    indicatorCount: indicatorIds.length,
    validIndicatorCount: validCvCount,
    compositeCV: compositeCV !== null ? Math.round(compositeCV * 10000) / 10000 : null,
    threshold,
    isCompliant: compositeCV !== null ? compositeCV <= threshold : null,
    indicators: indicatorResults
  };
}

/**
 * 执行聚合规则
 * @param {object} db - 数据库实例
 * @param {object} rule - 规则对象
 * @param {object} context - 上下文 { projectId, districtId, schoolType }
 * @returns {object} 聚合结果
 */
function executeAggregationRule(db, rule, context) {
  const { projectId, districtId, schoolType, entityType = 'school' } = context;

  // 解析规则配置
  const actions = rule.actions || [];
  const results = [];

  for (const action of actions) {
    if (action.actionType !== 'aggregate') continue;

    const config = typeof action.config === 'string'
      ? JSON.parse(action.config)
      : action.config;

    const aggConfig = config.aggregation;
    if (!aggConfig) continue;

    const { function: aggFunc, groupBy, valueField, filter: filterConfig } = aggConfig;

    // 构建数据查询
    let query = '';
    const params = [];

    if (entityType === 'school') {
      query = `
        SELECT
          sid.value,
          s.id as schoolId,
          s.name as schoolName,
          s.school_type as schoolType,
          s.district_id as districtId
        FROM school_indicator_data sid
        JOIN schools s ON sid.school_id = s.id
        WHERE sid.project_id = ?
      `;
      params.push(projectId);

      if (districtId) {
        query += ' AND s.district_id = ?';
        params.push(districtId);
      }

      if (rule.indicatorId) {
        query += ' AND sid.data_indicator_id = ?';
        params.push(rule.indicatorId);
      }

      if (schoolType) {
        query += ' AND s.school_type = ?';
        params.push(schoolType);
      }

      query += ' AND sid.value IS NOT NULL';
    }

    try {
      const rows = db.prepare(query).all(...params);

      // 执行聚合
      const aggregated = aggregateByGroup(rows, {
        valueField: 'value',
        groupBy: groupBy || [],
        aggregateFunction: aggFunc
      });

      results.push({
        ruleId: rule.id,
        actionId: action.id,
        function: aggFunc,
        groupBy,
        result: aggregated
      });
    } catch (e) {
      console.error('Execute aggregation rule error:', e);
      results.push({
        ruleId: rule.id,
        actionId: action.id,
        error: e.message
      });
    }
  }

  return results;
}

/**
 * 生成区县统计报表数据
 * @param {object} db - 数据库实例
 * @param {string} projectId - 项目ID
 * @param {string} districtId - 区县ID
 * @returns {object} 报表数据
 */
function generateDistrictReport(db, projectId, districtId) {
  // 获取区县信息
  const district = db.prepare('SELECT id, name, code FROM districts WHERE id = ?').get(districtId);
  if (!district) return null;

  // 获取学校统计
  const schoolStats = db.prepare(`
    SELECT
      school_type as schoolType,
      COUNT(*) as count,
      SUM(student_count) as studentCount,
      SUM(teacher_count) as teacherCount
    FROM schools
    WHERE district_id = ? AND status = 'active'
    GROUP BY school_type
  `).all(districtId);

  // 小学和初中的差异系数
  const primaryCV = calculateCompositeCV(db, projectId, districtId, [], { schoolType: '小学' });
  const middleCV = calculateCompositeCV(db, projectId, districtId, [], { schoolType: '初中' });

  // 达标率
  const complianceRate = calculateDistrictComplianceRate(db, projectId, districtId);

  return {
    district,
    generatedAt: new Date().toISOString(),
    projectId,
    schoolStats,
    primarySchool: {
      cv: primaryCV,
      cvThreshold: 0.50
    },
    middleSchool: {
      cv: middleCV,
      cvThreshold: 0.45
    },
    complianceRate
  };
}

module.exports = {
  AGGREGATE_FUNCTIONS,
  sum,
  avg,
  count,
  min,
  max,
  stddev,
  cv,
  executeAggregateFunction,
  aggregateByGroup,
  calculateDistrictComplianceRate,
  calculateDistrictCV,
  calculateCompositeCV,
  executeAggregationRule,
  generateDistrictReport
};
