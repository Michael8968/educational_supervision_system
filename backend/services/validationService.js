/**
 * 数据校验服务
 * 提供字段级校验、跨字段校验、格式校验等功能
 */

/**
 * 校验类型枚举
 */
const VALIDATION_TYPES = {
  REQUIRED: 'required',        // 必填
  RANGE: 'range',              // 数值范围
  PRECISION: 'precision',      // 小数精度
  REGEX: 'regex',              // 正则匹配
  ENUM: 'enum',                // 枚举值
  UNIQUE: 'unique',            // 唯一性
  CROSS_FIELD: 'cross_field',  // 跨字段校验
  CUSTOM: 'custom'             // 自定义
};

/**
 * 校验错误类
 */
class ValidationError {
  constructor(field, type, message, value = null) {
    this.field = field;
    this.type = type;
    this.message = message;
    this.value = value;
  }

  toJSON() {
    return {
      field: this.field,
      type: this.type,
      message: this.message,
      value: this.value
    };
  }
}

/**
 * 必填校验
 * @param {any} value - 值
 * @param {object} config - 配置
 * @returns {boolean} 是否通过
 */
function validateRequired(value, config = {}) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * 数值范围校验
 * @param {number} value - 值
 * @param {object} config - 配置 { min, max, minInclusive, maxInclusive }
 * @returns {boolean} 是否通过
 */
function validateRange(value, config) {
  if (value === null || value === undefined || value === '') return true; // 非必填时空值跳过

  const num = Number(value);
  if (isNaN(num)) return false;

  const { min, max, minInclusive = true, maxInclusive = true } = config;

  if (min !== undefined) {
    if (minInclusive ? num < min : num <= min) return false;
  }

  if (max !== undefined) {
    if (maxInclusive ? num > max : num >= max) return false;
  }

  return true;
}

/**
 * 小数精度校验
 * @param {number} value - 值
 * @param {object} config - 配置 { maxDecimals, autoRound }
 * @returns {boolean|number} 是否通过或自动修正后的值
 */
function validatePrecision(value, config) {
  if (value === null || value === undefined || value === '') return true;

  const num = Number(value);
  if (isNaN(num)) return false;

  const { maxDecimals = 2, autoRound = false } = config;

  const strValue = String(value);
  const decimalPart = strValue.includes('.') ? strValue.split('.')[1] : '';

  if (decimalPart.length > maxDecimals) {
    if (autoRound) {
      const factor = Math.pow(10, maxDecimals);
      return Math.round(num * factor) / factor;
    }
    return false;
  }

  return true;
}

/**
 * 正则表达式校验
 * @param {string} value - 值
 * @param {object} config - 配置 { pattern, flags }
 * @returns {boolean} 是否通过
 */
function validateRegex(value, config) {
  if (value === null || value === undefined || value === '') return true;

  const { pattern, flags = '' } = config;
  if (!pattern) return true;

  try {
    const regex = new RegExp(pattern, flags);
    return regex.test(String(value));
  } catch (e) {
    console.warn('Invalid regex pattern:', pattern, e);
    return false;
  }
}

/**
 * 枚举值校验
 * @param {any} value - 值
 * @param {object} config - 配置 { values, allowMultiple }
 * @returns {boolean} 是否通过
 */
function validateEnum(value, config) {
  if (value === null || value === undefined || value === '') return true;

  const { values = [], allowMultiple = false } = config;

  if (allowMultiple && Array.isArray(value)) {
    return value.every(v => values.includes(v));
  }

  return values.includes(value);
}

/**
 * 唯一性校验
 * @param {object} db - 数据库实例
 * @param {any} value - 值
 * @param {object} config - 配置 { table, column, excludeId }
 * @returns {boolean} 是否通过
 */
function validateUnique(db, value, config) {
  if (value === null || value === undefined || value === '') return true;

  const { table, column, excludeId } = config;
  if (!table || !column) return true;

  // 使用参数化查询防止SQL注入
  let query = `SELECT COUNT(*) as count FROM ${table} WHERE ${column} = ?`;
  const params = [value];

  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }

  try {
    const result = db.prepare(query).get(...params);
    return result.count === 0;
  } catch (e) {
    console.warn('Unique validation error:', e);
    return true;
  }
}

/**
 * 跨字段校验
 * @param {object} data - 整个数据对象
 * @param {object} config - 配置 { rule, fields, operator }
 * @returns {boolean} 是否通过
 */
function validateCrossField(data, config) {
  const { rule, fields = [], operator } = config;

  // 提取字段值
  const values = fields.map(f => {
    const val = data[f];
    return val !== null && val !== undefined ? Number(val) : null;
  });

  // 如果有null值，跳过校验
  if (values.some(v => v === null || isNaN(v))) return true;

  switch (rule) {
    case 'less_than':
      // fields[0] < fields[1]
      return values[0] < values[1];

    case 'less_equal':
      // fields[0] <= fields[1]
      return values[0] <= values[1];

    case 'greater_than':
      // fields[0] > fields[1]
      return values[0] > values[1];

    case 'greater_equal':
      // fields[0] >= fields[1]
      return values[0] >= values[1];

    case 'equal':
      // fields[0] == fields[1]
      return values[0] === values[1];

    case 'sum_equal':
      // fields[0] + fields[1] + ... = fields[last]
      const sum = values.slice(0, -1).reduce((a, b) => a + b, 0);
      return Math.abs(sum - values[values.length - 1]) < 0.0001;

    case 'sum_less_equal':
      // fields[0] + fields[1] + ... <= fields[last]
      const total = values.slice(0, -1).reduce((a, b) => a + b, 0);
      return total <= values[values.length - 1];

    case 'ratio':
      // fields[0] / fields[1] 需要在范围内
      if (values[1] === 0) return true;
      const ratio = values[0] / values[1];
      const { min = 0, max = Infinity } = config;
      return ratio >= min && ratio <= max;

    default:
      return true;
  }
}

/**
 * 校验单个字段
 * @param {any} value - 字段值
 * @param {Array} rules - 校验规则数组
 * @param {object} context - 上下文 { data, db, fieldName }
 * @returns {ValidationError[]} 错误数组
 */
function validateField(value, rules, context = {}) {
  const errors = [];
  const { data = {}, db, fieldName = 'field' } = context;

  for (const rule of rules) {
    const config = typeof rule.config === 'string'
      ? JSON.parse(rule.config)
      : (rule.config || {});

    let valid = true;
    let message = rule.errorMessage || '';

    switch (rule.validationType || rule.type) {
      case VALIDATION_TYPES.REQUIRED:
        valid = validateRequired(value, config);
        message = message || '此字段为必填项';
        break;

      case VALIDATION_TYPES.RANGE:
        valid = validateRange(value, config);
        if (!valid) {
          if (config.min !== undefined && config.max !== undefined) {
            message = message || `值必须在 ${config.min} - ${config.max} 之间`;
          } else if (config.min !== undefined) {
            message = message || `值不能小于 ${config.min}`;
          } else if (config.max !== undefined) {
            message = message || `值不能大于 ${config.max}`;
          }
        }
        break;

      case VALIDATION_TYPES.PRECISION:
        const precisionResult = validatePrecision(value, config);
        if (typeof precisionResult === 'number') {
          // 自动修正了值
          context.correctedValue = precisionResult;
          valid = true;
        } else {
          valid = precisionResult;
          message = message || `最多保留${config.maxDecimals || 2}位小数`;
        }
        break;

      case VALIDATION_TYPES.REGEX:
        valid = validateRegex(value, config);
        message = message || '格式不正确';
        break;

      case VALIDATION_TYPES.ENUM:
        valid = validateEnum(value, config);
        message = message || `值必须是以下选项之一: ${(config.values || []).join(', ')}`;
        break;

      case VALIDATION_TYPES.UNIQUE:
        valid = validateUnique(db, value, config);
        message = message || '该值已存在，请使用其他值';
        break;

      case VALIDATION_TYPES.CROSS_FIELD:
        valid = validateCrossField(data, config);
        message = message || '字段间数据不一致';
        break;
    }

    if (!valid) {
      errors.push(new ValidationError(fieldName, rule.validationType || rule.type, message, value));
    }
  }

  return errors;
}

/**
 * 校验整个表单数据
 * @param {object} data - 表单数据
 * @param {object} schema - 校验模式 { fieldName: [rules] }
 * @param {object} options - 选项 { db, stopOnFirstError }
 * @returns {object} { valid: boolean, errors: ValidationError[], correctedData: object }
 */
function validateForm(data, schema, options = {}) {
  const { db, stopOnFirstError = false } = options;
  const errors = [];
  const correctedData = { ...data };

  for (const [fieldName, rules] of Object.entries(schema)) {
    const value = data[fieldName];
    const context = {
      data,
      db,
      fieldName
    };

    const fieldErrors = validateField(value, rules, context);

    if (fieldErrors.length > 0) {
      errors.push(...fieldErrors);
      if (stopOnFirstError) break;
    }

    // 应用修正值
    if (context.correctedValue !== undefined) {
      correctedData[fieldName] = context.correctedValue;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    correctedData
  };
}

/**
 * 从数据库加载校验规则
 * @param {object} db - 数据库实例
 * @param {string} targetType - 目标类型 (element, indicator, tool)
 * @param {string} targetId - 目标ID
 * @returns {Array} 校验规则数组
 */
function loadValidationRules(db, targetType, targetId) {
  try {
    const rules = db.prepare(`
      SELECT id, validation_type as validationType, config, error_message as errorMessage
      FROM validation_configs
      WHERE target_type = ? AND target_id = ? AND enabled = 1
    `).all(targetType, targetId);

    return rules.map(rule => ({
      ...rule,
      config: typeof rule.config === 'string' ? JSON.parse(rule.config) : rule.config
    }));
  } catch (e) {
    console.warn('Load validation rules error:', e);
    return [];
  }
}

/**
 * 保存校验规则
 * @param {object} db - 数据库实例
 * @param {object} rule - 规则对象
 * @returns {string} 规则ID
 */
function saveValidationRule(db, rule) {
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  const timestamp = new Date().toISOString();

  const id = rule.id || generateId();
  const config = typeof rule.config === 'object' ? JSON.stringify(rule.config) : rule.config;

  if (rule.id) {
    // 更新
    db.prepare(`
      UPDATE validation_configs
      SET validation_type = ?, config = ?, error_message = ?, enabled = ?, updated_at = ?
      WHERE id = ?
    `).run(
      rule.validationType,
      config,
      rule.errorMessage || '',
      rule.enabled !== false ? 1 : 0,
      timestamp,
      id
    );
  } else {
    // 新增
    db.prepare(`
      INSERT INTO validation_configs
      (id, target_type, target_id, validation_type, config, error_message, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      rule.targetType,
      rule.targetId,
      rule.validationType,
      config,
      rule.errorMessage || '',
      rule.enabled !== false ? 1 : 0,
      timestamp,
      timestamp
    );
  }

  return id;
}

/**
 * 预设校验规则模板
 */
const VALIDATION_PRESETS = {
  // 正整数
  positiveInteger: [
    { validationType: 'range', config: { min: 0 }, errorMessage: '值不能为负数' },
    { validationType: 'precision', config: { maxDecimals: 0 }, errorMessage: '请输入整数' }
  ],

  // 百分比 (0-100)
  percentage: [
    { validationType: 'range', config: { min: 0, max: 100 }, errorMessage: '百分比必须在0-100之间' },
    { validationType: 'precision', config: { maxDecimals: 2 }, errorMessage: '最多保留2位小数' }
  ],

  // 面积 (保留2位小数)
  area: [
    { validationType: 'range', config: { min: 0 }, errorMessage: '面积不能为负数' },
    { validationType: 'precision', config: { maxDecimals: 2 }, errorMessage: '最多保留2位小数' }
  ],

  // 金额 (保留2位小数)
  currency: [
    { validationType: 'range', config: { min: 0 }, errorMessage: '金额不能为负数' },
    { validationType: 'precision', config: { maxDecimals: 2 }, errorMessage: '最多保留2分' }
  ],

  // 比例 (如17:1格式)
  ratio: [
    { validationType: 'regex', config: { pattern: '^\\d+(\\.\\d+)?:\\d+(\\.\\d+)?$' }, errorMessage: '请输入正确的比例格式，如 17:1' }
  ],

  // 学生数
  studentCount: [
    { validationType: 'range', config: { min: 0, max: 50000 }, errorMessage: '学生数必须在0-50000之间' },
    { validationType: 'precision', config: { maxDecimals: 0 }, errorMessage: '请输入整数' }
  ],

  // 教师数
  teacherCount: [
    { validationType: 'range', config: { min: 0, max: 5000 }, errorMessage: '教师数必须在0-5000之间' },
    { validationType: 'precision', config: { maxDecimals: 0 }, errorMessage: '请输入整数' }
  ],

  // 班级规模
  classSize: [
    { validationType: 'range', config: { min: 1, max: 100 }, errorMessage: '班额必须在1-100之间' },
    { validationType: 'precision', config: { maxDecimals: 0 }, errorMessage: '请输入整数' }
  ]
};

/**
 * 获取预设校验规则
 * @param {string} presetName - 预设名称
 * @returns {Array} 校验规则数组
 */
function getPresetRules(presetName) {
  return VALIDATION_PRESETS[presetName] || [];
}

module.exports = {
  VALIDATION_TYPES,
  ValidationError,
  validateRequired,
  validateRange,
  validatePrecision,
  validateRegex,
  validateEnum,
  validateUnique,
  validateCrossField,
  validateField,
  validateForm,
  loadValidationRules,
  saveValidationRule,
  VALIDATION_PRESETS,
  getPresetRules
};
