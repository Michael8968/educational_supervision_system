/**
 * 公式计算器
 * 用于计算派生要素的值和多填报汇总
 */

import type { AggregationMethod, AggregationScope } from '../services/toolService';

// 支持的运算符
const OPERATORS = ['+', '-', '*', '/', '%', '(', ')'];

// 运算符优先级
const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
};

/**
 * 解析公式中的变量
 * 支持的变量格式：E001, E002, ${E001}, {fieldId}
 * @param formula 公式字符串
 * @returns 变量列表
 */
export function parseVariables(formula: string): string[] {
  if (!formula) return [];

  const variables: Set<string> = new Set();

  // 匹配 ${xxx} 格式
  const dollarBracePattern = /\$\{([^}]+)\}/g;
  let match;
  while ((match = dollarBracePattern.exec(formula)) !== null) {
    variables.add(match[1]);
  }

  // 匹配 {xxx} 格式
  const bracePattern = /\{([^}]+)\}/g;
  while ((match = bracePattern.exec(formula)) !== null) {
    variables.add(match[1]);
  }

  // 匹配字母开头的标识符（如 E001, E002）
  const identifierPattern = /\b([A-Za-z][A-Za-z0-9_]*)\b/g;
  while ((match = identifierPattern.exec(formula)) !== null) {
    // 排除运算符和关键字
    const identifier = match[1];
    if (!['Math', 'PI', 'E'].includes(identifier)) {
      variables.add(identifier);
    }
  }

  return Array.from(variables);
}

/**
 * 替换公式中的变量为实际值
 * @param formula 公式字符串
 * @param values 变量值映射
 * @returns 替换后的公式
 */
function replaceVariables(formula: string, values: Record<string, number>): string {
  let result = formula;

  // 替换 ${xxx} 格式
  result = result.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    const value = values[varName];
    return value !== undefined ? String(value) : '0';
  });

  // 替换 {xxx} 格式
  result = result.replace(/\{([^}]+)\}/g, (_, varName) => {
    const value = values[varName];
    return value !== undefined ? String(value) : '0';
  });

  // 替换标识符格式（从长到短排序，避免部分替换）
  const varNames = Object.keys(values).sort((a, b) => b.length - a.length);
  for (const varName of varNames) {
    const regex = new RegExp(`\\b${varName}\\b`, 'g');
    result = result.replace(regex, String(values[varName]));
  }

  return result;
}

/**
 * 安全计算数学表达式
 * 只支持基本的数学运算，不使用 eval
 * @param expression 表达式字符串
 * @returns 计算结果
 */
function safeEvaluate(expression: string): number {
  // 移除空格
  expression = expression.replace(/\s+/g, '');

  // 验证表达式只包含数字、运算符和括号
  if (!/^[\d+\-*/%().]+$/.test(expression)) {
    throw new Error('表达式包含非法字符');
  }

  // 使用 Function 构造安全的计算环境（比 eval 更安全）
  try {
    // 创建一个只能执行数学运算的函数
    const fn = new Function(`return (${expression})`);
    const result = fn();

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('计算结果无效');
    }

    return result;
  } catch (error) {
    throw new Error(`表达式计算错误: ${(error as Error).message}`);
  }
}

/**
 * 计算公式结果
 * @param formula 公式字符串
 * @param values 变量值映射
 * @returns 计算结果
 */
export function calculate(formula: string, values: Record<string, number>): number {
  if (!formula) {
    throw new Error('公式不能为空');
  }

  // 检查所需变量是否都有值
  const variables = parseVariables(formula);
  const missingVars = variables.filter(v => values[v] === undefined);
  if (missingVars.length > 0) {
    throw new Error(`缺少变量值: ${missingVars.join(', ')}`);
  }

  // 替换变量
  const expression = replaceVariables(formula, values);

  // 计算结果
  return safeEvaluate(expression);
}

/**
 * 验证公式语法
 * @param formula 公式字符串
 * @returns 验证结果
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || formula.trim() === '') {
    return { valid: false, error: '公式不能为空' };
  }

  // 检查括号匹配
  let parenCount = 0;
  for (const char of formula) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      return { valid: false, error: '括号不匹配' };
    }
  }
  if (parenCount !== 0) {
    return { valid: false, error: '括号不匹配' };
  }

  // 尝试用测试值计算
  try {
    const variables = parseVariables(formula);
    const testValues: Record<string, number> = {};
    variables.forEach(v => {
      testValues[v] = 1; // 使用测试值
    });
    calculate(formula, testValues);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: (error as Error).message };
  }
}

/**
 * 阈值校验
 */
export interface ThresholdConfig {
  threshold: string;        // 原始阈值字符串，如 "≤0.50", "≥95%", "100%"
  operator?: string;        // 比较操作符
  value?: number;           // 阈值数值
  minValue?: number;        // 范围最小值
  maxValue?: number;        // 范围最大值
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  warning?: boolean;        // 是否为警告（非阻断）
}

/**
 * 解析阈值字符串
 * @param threshold 阈值字符串
 * @returns 解析后的配置
 */
export function parseThreshold(threshold: string): ThresholdConfig {
  const config: ThresholdConfig = { threshold };

  if (!threshold) return config;

  // 移除百分号并处理
  let normalizedThreshold = threshold.trim();
  let isPercentage = false;

  if (normalizedThreshold.endsWith('%')) {
    isPercentage = true;
    normalizedThreshold = normalizedThreshold.slice(0, -1);
  }

  // 解析操作符和数值
  const operators = ['≤', '≥', '<=', '>=', '<', '>', '=', '=='];

  for (const op of operators) {
    if (normalizedThreshold.startsWith(op)) {
      config.operator = op.replace('<=', '≤').replace('>=', '≥').replace('==', '=');
      const valueStr = normalizedThreshold.slice(op.length).trim();
      const value = parseFloat(valueStr);
      if (!isNaN(value)) {
        config.value = isPercentage ? value : value;
      }
      return config;
    }
  }

  // 尝试解析为范围 (如 "0.3-0.5")
  if (normalizedThreshold.includes('-') && !normalizedThreshold.startsWith('-')) {
    const parts = normalizedThreshold.split('-');
    if (parts.length === 2) {
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      if (!isNaN(min) && !isNaN(max)) {
        config.minValue = min;
        config.maxValue = max;
        config.operator = 'range';
        return config;
      }
    }
  }

  // 尝试解析为单个数值（等于）
  const value = parseFloat(normalizedThreshold);
  if (!isNaN(value)) {
    config.operator = '=';
    config.value = value;
  }

  return config;
}

/**
 * 校验值是否满足阈值要求
 * @param value 要校验的值
 * @param thresholdConfig 阈值配置
 * @returns 校验结果
 */
export function validateThreshold(
  value: number,
  thresholdConfig: ThresholdConfig
): ValidationResult {
  const { operator, value: threshold, minValue, maxValue, threshold: original } = thresholdConfig;

  if (!operator || (threshold === undefined && minValue === undefined)) {
    // 无法解析阈值，返回警告
    return { valid: true, warning: true, message: `无法解析阈值: ${original}` };
  }

  // 范围校验
  if (operator === 'range' && minValue !== undefined && maxValue !== undefined) {
    if (value >= minValue && value <= maxValue) {
      return { valid: true };
    }
    return {
      valid: false,
      message: `值 ${value} 不在阈值范围 ${minValue}-${maxValue} 内`,
    };
  }

  // 比较校验
  if (threshold !== undefined) {
    let isValid = false;
    switch (operator) {
      case '≤':
      case '<=':
        isValid = value <= threshold;
        break;
      case '≥':
      case '>=':
        isValid = value >= threshold;
        break;
      case '<':
        isValid = value < threshold;
        break;
      case '>':
        isValid = value > threshold;
        break;
      case '=':
      case '==':
        isValid = Math.abs(value - threshold) < 0.0001; // 浮点数比较
        break;
      default:
        return { valid: true, warning: true, message: `未知操作符: ${operator}` };
    }

    if (isValid) {
      return { valid: true };
    }
    return {
      valid: false,
      message: `值 ${value} 不满足阈值要求 ${original}`,
    };
  }

  return { valid: true };
}

// ==================== 聚合计算 ====================

/**
 * 聚合方法显示名称映射
 */
export const AGGREGATION_METHOD_LABELS: Record<AggregationMethod, string> = {
  sum: '求和 (SUM)',
  avg: '平均值 (AVG)',
  count: '计数 (COUNT)',
  max: '最大值 (MAX)',
  min: '最小值 (MIN)',
  median: '中位数 (MEDIAN)',
  stddev: '标准差 (STDDEV)',
  range: '极差 (RANGE)',
  cv: '差异系数 (CV)',
};

/**
 * 聚合范围显示名称映射
 */
export const AGGREGATION_SCOPE_LABELS: Record<string, string> = {
  all: '全部样本',
  district: '按区县',
  school_type: '按学校类型',
  custom: '自定义条件',
};

/**
 * 执行聚合计算
 * @param values 原始数值数组
 * @param method 聚合方法
 * @returns 聚合结果
 */
export function aggregate(values: number[], method: AggregationMethod): number {
  if (!values || values.length === 0) {
    return 0;
  }

  // 过滤掉非数字值
  const nums = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));

  if (nums.length === 0) {
    return 0;
  }

  switch (method) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0);

    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length;

    case 'count':
      return nums.length;

    case 'max':
      return Math.max(...nums);

    case 'min':
      return Math.min(...nums);

    case 'median': {
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    case 'stddev': {
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const squaredDiffs = nums.map(v => Math.pow(v - mean, 2));
      const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / nums.length;
      return Math.sqrt(avgSquaredDiff);
    }

    case 'range':
      return Math.max(...nums) - Math.min(...nums);

    case 'cv': {
      // 差异系数 = 标准差 / 平均值
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      if (mean === 0) return 0; // 避免除以0
      const squaredDiffs = nums.map(v => Math.pow(v - mean, 2));
      const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / nums.length;
      const stddev = Math.sqrt(avgSquaredDiff);
      return stddev / mean;
    }

    default:
      return nums.reduce((a, b) => a + b, 0);
  }
}

/**
 * 填报数据类型（用于聚合计算）
 */
export interface SubmissionData {
  sampleId: string;           // 填报主体ID（如学校ID）
  sampleName?: string;        // 填报主体名称
  sampleType?: string;        // 填报主体类型（如学校类型）
  districtId?: string;        // 所属区县ID
  districtName?: string;      // 所属区县名称
  toolId: string;             // 表单工具ID
  data: Record<string, any>;  // 表单填报数据
}

/**
 * 聚合计算结果
 */
export interface AggregationResult {
  elementCode: string;        // 要素编码
  elementName: string;        // 要素名称
  value: number;              // 聚合结果值
  method: AggregationMethod;  // 使用的聚合方法
  details: {
    sampleCount: number;      // 参与计算的样本数
    rawValues: number[];      // 原始值列表
    scope?: string;           // 聚合范围描述
  };
}

/**
 * 应用聚合范围过滤
 * @param submissions 填报数据列表
 * @param scope 聚合范围配置
 * @returns 过滤后的填报数据
 */
export function applyAggregationScope(
  submissions: SubmissionData[],
  scope?: AggregationScope
): SubmissionData[] {
  if (!scope || scope.level === 'all') {
    return submissions;
  }

  if (!scope.filter) {
    return submissions;
  }

  const { field, operator, value } = scope.filter;

  return submissions.filter(submission => {
    // 先从 data 中查找字段值，再从 submission 本身查找
    const fieldValue = submission.data[field] ?? (submission as any)[field];

    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    switch (operator) {
      case 'eq':
        return fieldValue === value;
      case 'ne':
        return fieldValue !== value;
      case 'gt':
        return Number(fieldValue) > Number(value);
      case 'lt':
        return Number(fieldValue) < Number(value);
      case 'gte':
        return Number(fieldValue) >= Number(value);
      case 'lte':
        return Number(fieldValue) <= Number(value);
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      default:
        return true;
    }
  });
}

/**
 * 从填报数据中提取指定字段的值
 * @param submissions 填报数据列表
 * @param fieldId 字段ID
 * @returns 数值数组
 */
export function extractFieldValues(
  submissions: SubmissionData[],
  fieldId: string
): number[] {
  return submissions
    .map(s => {
      const value = s.data[fieldId];
      if (value === undefined || value === null || value === '') {
        return NaN;
      }
      return Number(value);
    })
    .filter(v => !isNaN(v));
}

/**
 * 计算要素的聚合值
 * @param elementCode 要素编码
 * @param elementName 要素名称
 * @param fieldId 关联的表单字段ID
 * @param toolId 关联的表单工具ID
 * @param method 聚合方法
 * @param submissions 所有填报数据
 * @param scope 聚合范围（可选）
 * @returns 聚合计算结果
 */
export function calculateElementAggregation(
  elementCode: string,
  elementName: string,
  fieldId: string,
  toolId: string,
  method: AggregationMethod,
  submissions: SubmissionData[],
  scope?: AggregationScope
): AggregationResult {
  // 1. 筛选出该表单的填报数据
  const relevantSubmissions = submissions.filter(s => s.toolId === toolId);

  // 2. 应用聚合范围过滤
  const filteredSubmissions = applyAggregationScope(relevantSubmissions, scope);

  // 3. 提取字段值
  const rawValues = extractFieldValues(filteredSubmissions, fieldId);

  // 4. 执行聚合计算
  const value = aggregate(rawValues, method);

  // 5. 生成范围描述
  let scopeDesc = '全部样本';
  if (scope && scope.level !== 'all' && scope.filter) {
    scopeDesc = `${scope.filter.field} ${scope.filter.operator} ${scope.filter.value}`;
  }

  return {
    elementCode,
    elementName,
    value,
    method,
    details: {
      sampleCount: filteredSubmissions.length,
      rawValues,
      scope: scopeDesc,
    },
  };
}

/**
 * 批量计算要素聚合值
 * @param elements 要素列表（需包含聚合配置）
 * @param submissions 所有填报数据
 * @returns 要素编码到聚合结果的映射
 */
export function calculateBatchAggregation(
  elements: Array<{
    code: string;
    name: string;
    fieldId?: string;
    toolId?: string;
    aggregation?: {
      enabled: boolean;
      method: AggregationMethod;
      scope?: AggregationScope;
    };
  }>,
  submissions: SubmissionData[]
): Map<string, AggregationResult> {
  const results = new Map<string, AggregationResult>();

  for (const element of elements) {
    // 只处理启用了聚合的要素
    if (!element.aggregation?.enabled || !element.fieldId || !element.toolId) {
      continue;
    }

    const result = calculateElementAggregation(
      element.code,
      element.name,
      element.fieldId,
      element.toolId,
      element.aggregation.method,
      submissions,
      element.aggregation.scope
    );

    results.set(element.code, result);
  }

  return results;
}

/**
 * 要素定义接口（用于派生要素聚合计算）
 */
export interface ElementDefinition {
  code: string;
  name: string;
  elementType: '基础要素' | '派生要素';
  dataType?: string;
  formula?: string;                    // 派生要素的计算公式
  fieldId?: string;                    // 基础要素关联的字段ID
  toolId?: string;                     // 基础要素关联的工具ID
  aggregation?: {
    enabled: boolean;
    method: AggregationMethod;
    scope?: AggregationScope;
  };
}

/**
 * 计算单个样本的派生要素值
 * 递归计算：如果派生要素依赖其他派生要素，会先计算依赖的要素
 * @param elementCode 要计算的要素编码
 * @param elements 所有要素定义
 * @param sampleData 单个样本的填报数据
 * @param calculatedCache 已计算的要素值缓存（避免重复计算）
 * @returns 计算结果，null 表示无法计算
 */
export function calculateDerivedValueForSample(
  elementCode: string,
  elements: ElementDefinition[],
  sampleData: Record<string, any>,
  calculatedCache: Map<string, number> = new Map()
): number | null {
  // 如果已经计算过，直接返回缓存
  if (calculatedCache.has(elementCode)) {
    return calculatedCache.get(elementCode) ?? null;
  }

  const element = elements.find(e => e.code === elementCode);
  if (!element) {
    console.warn(`[派生计算] 未找到要素: ${elementCode}`);
    return null;
  }

  // 基础要素：直接从填报数据中获取
  if (element.elementType === '基础要素') {
    if (!element.fieldId) {
      console.warn(`[派生计算] 基础要素 ${elementCode} 没有关联字段`);
      return null;
    }
    const value = sampleData[element.fieldId];
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return null;
    }
    calculatedCache.set(elementCode, numValue);
    return numValue;
  }

  // 派生要素：通过公式计算
  if (element.elementType === '派生要素') {
    if (!element.formula) {
      console.warn(`[派生计算] 派生要素 ${elementCode} 没有公式`);
      return null;
    }

    // 解析公式中引用的要素
    const referencedCodes = parseVariables(element.formula);
    const values: Record<string, number> = {};

    // 递归计算每个引用的要素
    for (const refCode of referencedCodes) {
      const refValue = calculateDerivedValueForSample(refCode, elements, sampleData, calculatedCache);
      if (refValue === null) {
        // 如果任何依赖的要素无法计算，则整个派生要素无法计算
        return null;
      }
      values[refCode] = refValue;
    }

    // 计算公式
    try {
      const result = calculate(element.formula, values);
      calculatedCache.set(elementCode, result);
      return result;
    } catch (error) {
      console.warn(`[派生计算] 计算公式失败: ${element.formula}`, error);
      return null;
    }
  }

  return null;
}

/**
 * 计算派生要素的聚合值（多样本聚合）
 *
 * 计算流程：
 * 1. 对每个填报样本，计算派生公式得到该样本的派生值
 * 2. 收集所有样本的派生值
 * 3. 对派生值列表执行聚合计算（如差异系数 CV）
 *
 * @param derivedElement 派生要素定义（必须有公式和聚合配置）
 * @param allElements 所有要素定义（用于递归计算依赖）
 * @param submissions 所有填报数据
 * @returns 聚合计算结果
 */
export function calculateDerivedElementAggregation(
  derivedElement: ElementDefinition,
  allElements: ElementDefinition[],
  submissions: SubmissionData[]
): AggregationResult {
  const { code, name, formula, aggregation } = derivedElement;

  // 验证参数
  if (derivedElement.elementType !== '派生要素') {
    throw new Error(`要素 ${code} 不是派生要素`);
  }
  if (!formula) {
    throw new Error(`派生要素 ${code} 没有计算公式`);
  }
  if (!aggregation?.enabled) {
    throw new Error(`派生要素 ${code} 没有启用聚合`);
  }

  // 1. 应用聚合范围过滤
  const filteredSubmissions = applyAggregationScope(submissions, aggregation.scope);

  // 2. 为每个样本计算派生值
  const derivedValues: number[] = [];
  const sampleDetails: Array<{ sampleId: string; sampleName?: string; value: number }> = [];

  for (const submission of filteredSubmissions) {
    const calculatedCache = new Map<string, number>();
    const value = calculateDerivedValueForSample(code, allElements, submission.data, calculatedCache);

    if (value !== null && !isNaN(value) && isFinite(value)) {
      derivedValues.push(value);
      sampleDetails.push({
        sampleId: submission.sampleId,
        sampleName: submission.sampleName,
        value,
      });
    }
  }

  // 3. 执行聚合计算
  const aggregatedValue = aggregate(derivedValues, aggregation.method);

  // 4. 生成范围描述
  let scopeDesc = '全部样本';
  if (aggregation.scope && aggregation.scope.level !== 'all' && aggregation.scope.filter) {
    scopeDesc = `${aggregation.scope.filter.field} ${aggregation.scope.filter.operator} ${aggregation.scope.filter.value}`;
  }

  return {
    elementCode: code,
    elementName: name,
    value: aggregatedValue,
    method: aggregation.method,
    details: {
      sampleCount: derivedValues.length,
      rawValues: derivedValues,
      scope: scopeDesc,
    },
  };
}

/**
 * 批量计算要素聚合值（支持基础要素和派生要素）
 * @param elements 要素列表（需包含聚合配置）
 * @param submissions 所有填报数据
 * @returns 要素编码到聚合结果的映射
 */
export function calculateAllElementsAggregation(
  elements: ElementDefinition[],
  submissions: SubmissionData[]
): Map<string, AggregationResult> {
  const results = new Map<string, AggregationResult>();

  for (const element of elements) {
    // 只处理启用了聚合的要素
    if (!element.aggregation?.enabled) {
      continue;
    }

    try {
      if (element.elementType === '基础要素') {
        // 基础要素聚合
        if (!element.fieldId || !element.toolId) {
          continue;
        }
        const result = calculateElementAggregation(
          element.code,
          element.name,
          element.fieldId,
          element.toolId,
          element.aggregation.method,
          submissions,
          element.aggregation.scope
        );
        results.set(element.code, result);
      } else if (element.elementType === '派生要素') {
        // 派生要素聚合
        if (!element.formula) {
          continue;
        }
        const result = calculateDerivedElementAggregation(
          element,
          elements,
          submissions
        );
        results.set(element.code, result);
      }
    } catch (error) {
      console.error(`[聚合计算] 要素 ${element.code} 计算失败:`, error);
    }
  }

  return results;
}

/**
 * 公式计算器类
 */
export class FormulaCalculator {
  /**
   * 解析公式中的变量
   */
  parseVariables = parseVariables;

  /**
   * 计算公式结果
   */
  calculate = calculate;

  /**
   * 验证公式语法
   */
  validate = validateFormula;

  /**
   * 解析阈值
   */
  parseThreshold = parseThreshold;

  /**
   * 校验阈值
   */
  validateThreshold = validateThreshold;

  /**
   * 执行聚合计算
   */
  aggregate = aggregate;

  /**
   * 计算要素聚合值（基础要素）
   */
  calculateElementAggregation = calculateElementAggregation;

  /**
   * 批量计算要素聚合值（基础要素）
   */
  calculateBatchAggregation = calculateBatchAggregation;

  /**
   * 计算单个样本的派生要素值
   */
  calculateDerivedValueForSample = calculateDerivedValueForSample;

  /**
   * 计算派生要素的聚合值
   */
  calculateDerivedElementAggregation = calculateDerivedElementAggregation;

  /**
   * 批量计算所有要素聚合值（支持基础要素和派生要素）
   */
  calculateAllElementsAggregation = calculateAllElementsAggregation;
}

export default FormulaCalculator;
