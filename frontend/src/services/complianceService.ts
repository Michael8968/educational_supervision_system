/**
 * 达标判定规则服务
 * 提供规则管理、评估执行、数据校验等API
 */

import { get, post, put, del } from './api';

// ==================== 类型定义 ====================

// 规则类型
export type RuleType = 'threshold' | 'conditional' | 'validation' | 'aggregation';

// 机构类型
export type InstitutionType = 'county' | 'primary' | 'middle' | 'nine_year' | 'complete' | 'teaching_point';

// 条件操作符
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'between'
  | 'is_null'
  | 'is_not_null';

// 阈值操作符
export type ThresholdOperator = '>=' | '>' | '<=' | '<' | '==' | '!=' | 'between';

// 动作类型
export type ActionType = 'compare' | 'validate' | 'calculate' | 'aggregate';

// 校验类型
export type ValidationType = 'required' | 'range' | 'precision' | 'regex' | 'enum' | 'unique' | 'cross_field';

// 聚合函数
export type AggregateFunction = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'STDDEV' | 'CV';

// 规则条件
export interface RuleCondition {
  id?: string;
  field: string;
  operator: ConditionOperator;
  value: string | number | string[] | number[];
  logicalOperator?: 'AND' | 'OR';
  sortOrder?: number;
}

// 阈值配置
export interface ThresholdConfig {
  operator: ThresholdOperator;
  value: number | string;
  valueType: 'fixed' | 'element' | 'formula';
  elementId?: string;
  formula?: string;
}

// 校验配置
export interface ValidationConfig {
  type: ValidationType;
  params: Record<string, unknown>;
}

// 聚合配置
export interface AggregationConfig {
  function: AggregateFunction;
  groupBy?: string[];
  filter?: RuleCondition[];
}

// 规则动作配置
export interface RuleActionConfig {
  threshold?: ThresholdConfig;
  validation?: ValidationConfig;
  aggregation?: AggregationConfig;
  valueField?: string;
}

// 规则动作
export interface RuleAction {
  id?: string;
  actionType: ActionType;
  config: RuleActionConfig;
  resultField?: string;
  passMessage?: string;
  failMessage?: string;
  sortOrder?: number;
}

// 规则定义
export interface ComplianceRule {
  id: string;
  code: string;
  name: string;
  ruleType: RuleType;
  indicatorId?: string;
  indicatorCode?: string;
  indicatorName?: string;
  elementId?: string;
  elementCode?: string;
  elementName?: string;
  enabled: boolean;
  priority: number;
  description?: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

// 规则列表项（简化版）
export interface ComplianceRuleListItem {
  id: string;
  code: string;
  name: string;
  ruleType: RuleType;
  indicatorId?: string;
  indicatorCode?: string;
  indicatorName?: string;
  elementId?: string;
  elementCode?: string;
  elementName?: string;
  enabled: boolean;
  priority: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 达标结果
export interface ComplianceResult {
  id: string;
  ruleId: string;
  ruleCode?: string;
  ruleName?: string;
  entityType: 'school' | 'county' | 'indicator';
  entityId: string;
  schoolName?: string;
  schoolCode?: string;
  indicatorId?: string;
  indicatorCode?: string;
  indicatorName?: string;
  actualValue: number | string | null;
  thresholdValue: number | string | null;
  isCompliant: boolean | null;
  message: string;
  details?: Record<string, unknown>;
  calculatedAt: string;
}

// 评估汇总
export interface EvaluationSummary {
  totalRules: number;
  totalSchools: number;
  totalEvaluations: number;
  compliantCount: number;
  nonCompliantCount: number;
  pendingCount: number;
  complianceRate: number;
}

// 评估结果
export interface EvaluationResult {
  summary: EvaluationSummary;
  results: ComplianceResult[];
}

// 学校达标汇总
export interface SchoolComplianceSummary {
  school: {
    id: string;
    name: string;
    code: string;
    schoolType: string;
    districtId: string;
  };
  summary: {
    total: number;
    compliant: number;
    nonCompliant: number;
    pending: number;
    complianceRate: number | null;
  };
  nonCompliantItems: Array<{
    id: string;
    indicatorId: string;
    indicatorCode: string;
    indicatorName: string;
    actualValue: number | string;
    thresholdValue: number | string;
    message: string;
  }>;
}

// 阈值标准
export interface ThresholdStandard {
  id: string;
  indicatorId: string;
  indicatorCode?: string;
  indicatorName?: string;
  institutionType: InstitutionType;
  thresholdOperator: ThresholdOperator;
  thresholdValue: string;
  unit?: string;
  source?: string;
  effectiveDate?: string;
  expiryDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 差异系数结果
export interface CVResult {
  districtId: string;
  indicatorId?: string;
  schoolCount: number;
  cv: number | null;
  mean: number | null;
  stdDev: number | null;
  isCompliant: boolean | null;
  threshold: number;
  schools?: Array<{
    schoolId: string;
    schoolName: string;
    value: number;
  }>;
}

// 综合差异系数结果
export interface CompositeCVResult {
  districtId: string;
  schoolType: string;
  indicatorCount: number;
  validIndicatorCount: number;
  compositeCV: number | null;
  threshold: number;
  isCompliant: boolean | null;
  indicators: CVResult[];
}

// 区县达标率
export interface DistrictComplianceRate {
  districtId: string;
  summary: {
    totalIndicators: number;
    totalEvaluations: number;
    totalCompliant: number;
    totalNonCompliant: number;
    overallComplianceRate: number | null;
  };
  indicators: Array<{
    indicatorId: string;
    indicatorCode: string;
    indicatorName: string;
    total: number;
    compliant: number;
    nonCompliant: number;
    complianceRate: number | null;
  }>;
}

// 校验错误
export interface ValidationError {
  field: string;
  type: ValidationType;
  message: string;
  value?: unknown;
}

// 校验结果
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  correctedData?: Record<string, unknown>;
}

// 创建规则请求
export interface CreateRuleRequest {
  code: string;
  name: string;
  ruleType: RuleType;
  indicatorId?: string;
  elementId?: string;
  enabled?: boolean;
  priority?: number;
  description?: string;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
}

// 更新规则请求
export type UpdateRuleRequest = CreateRuleRequest;

// ==================== API 方法 ====================

/**
 * 获取规则列表
 */
export async function getComplianceRules(params?: {
  ruleType?: RuleType;
  indicatorId?: string;
  enabled?: boolean;
}): Promise<ComplianceRuleListItem[]> {
  const queryParams = new URLSearchParams();
  if (params?.ruleType) queryParams.append('ruleType', params.ruleType);
  if (params?.indicatorId) queryParams.append('indicatorId', params.indicatorId);
  if (params?.enabled !== undefined) queryParams.append('enabled', String(params.enabled));

  const query = queryParams.toString();
  return get<ComplianceRuleListItem[]>(`/compliance-rules${query ? `?${query}` : ''}`);
}

/**
 * 获取规则详情
 */
export async function getComplianceRule(id: string): Promise<ComplianceRule> {
  return get<ComplianceRule>(`/compliance-rules/${id}`);
}

/**
 * 创建规则
 */
export async function createComplianceRule(data: CreateRuleRequest): Promise<{ id: string }> {
  return post<{ id: string }>('/compliance-rules', data);
}

/**
 * 更新规则
 */
export async function updateComplianceRule(id: string, data: UpdateRuleRequest): Promise<void> {
  return put(`/compliance-rules/${id}`, data);
}

/**
 * 删除规则
 */
export async function deleteComplianceRule(id: string): Promise<void> {
  return del(`/compliance-rules/${id}`);
}

/**
 * 切换规则启用状态
 */
export async function toggleComplianceRule(id: string): Promise<{ enabled: boolean }> {
  return post<{ enabled: boolean }>(`/compliance-rules/${id}/toggle`);
}

/**
 * 测试规则执行
 */
export async function testComplianceRule(
  id: string,
  entities: Record<string, unknown>[]
): Promise<{ ruleId: string; totalEntities: number; results: ComplianceResult[] }> {
  return post(`/compliance-rules/${id}/test`, { entities });
}

/**
 * 执行项目规则评估
 */
export async function evaluateProject(
  projectId: string,
  options?: {
    schoolId?: string;
    indicatorId?: string;
    ruleType?: RuleType;
    saveResults?: boolean;
  }
): Promise<EvaluationResult> {
  return post<EvaluationResult>(`/projects/${projectId}/evaluate`, options || {});
}

/**
 * 获取项目评估结果
 */
export async function getProjectComplianceResults(
  projectId: string,
  params?: {
    schoolId?: string;
    indicatorId?: string;
    isCompliant?: boolean;
  }
): Promise<ComplianceResult[]> {
  const queryParams = new URLSearchParams();
  if (params?.schoolId) queryParams.append('schoolId', params.schoolId);
  if (params?.indicatorId) queryParams.append('indicatorId', params.indicatorId);
  if (params?.isCompliant !== undefined) queryParams.append('isCompliant', String(params.isCompliant));

  const query = queryParams.toString();
  return get<ComplianceResult[]>(`/projects/${projectId}/compliance-results${query ? `?${query}` : ''}`);
}

/**
 * 获取学校达标汇总
 */
export async function getSchoolComplianceSummary(
  schoolId: string,
  projectId: string
): Promise<SchoolComplianceSummary> {
  return get<SchoolComplianceSummary>(`/schools/${schoolId}/compliance-summary?projectId=${projectId}`);
}

/**
 * 获取阈值标准列表
 */
export async function getThresholdStandards(params?: {
  indicatorId?: string;
  institutionType?: InstitutionType;
}): Promise<ThresholdStandard[]> {
  const queryParams = new URLSearchParams();
  if (params?.indicatorId) queryParams.append('indicatorId', params.indicatorId);
  if (params?.institutionType) queryParams.append('institutionType', params.institutionType);

  const query = queryParams.toString();
  return get<ThresholdStandard[]>(`/threshold-standards${query ? `?${query}` : ''}`);
}

/**
 * 保存阈值标准
 */
export async function saveThresholdStandard(data: {
  indicatorId: string;
  institutionType: InstitutionType;
  thresholdOperator: ThresholdOperator;
  thresholdValue: string | number;
  unit?: string;
  source?: string;
  effectiveDate?: string;
  expiryDate?: string;
}): Promise<void> {
  return post('/threshold-standards', data);
}

/**
 * 校验表单数据
 */
export async function validateFormData(data: {
  data: Record<string, unknown>;
  schema?: Record<string, unknown[]>;
  targetType?: string;
  targetId?: string;
}): Promise<ValidationResult> {
  return post<ValidationResult>('/validate', data);
}

/**
 * 获取区县差异系数
 */
export async function getDistrictCV(
  districtId: string,
  projectId: string,
  params?: {
    indicatorId?: string;
    schoolType?: string;
  }
): Promise<CVResult | CompositeCVResult> {
  const queryParams = new URLSearchParams();
  queryParams.append('projectId', projectId);
  if (params?.indicatorId) queryParams.append('indicatorId', params.indicatorId);
  if (params?.schoolType) queryParams.append('schoolType', params.schoolType);

  return get(`/districts/${districtId}/cv?${queryParams.toString()}`);
}

/**
 * 获取区县达标率
 */
export async function getDistrictComplianceRate(
  districtId: string,
  projectId: string,
  params?: {
    indicatorId?: string;
    schoolType?: string;
  }
): Promise<DistrictComplianceRate> {
  const queryParams = new URLSearchParams();
  queryParams.append('projectId', projectId);
  if (params?.indicatorId) queryParams.append('indicatorId', params.indicatorId);
  if (params?.schoolType) queryParams.append('schoolType', params.schoolType);

  return get<DistrictComplianceRate>(`/districts/${districtId}/compliance-rate?${queryParams.toString()}`);
}

/**
 * 获取区县统计报表
 */
export async function getDistrictReport(
  districtId: string,
  projectId: string
): Promise<Record<string, unknown>> {
  return get(`/districts/${districtId}/report?projectId=${projectId}`);
}

// ==================== 辅助函数 ====================

/**
 * 获取规则类型显示名称
 */
export function getRuleTypeLabel(type: RuleType): string {
  const labels: Record<RuleType, string> = {
    threshold: '阈值规则',
    conditional: '条件规则',
    validation: '校验规则',
    aggregation: '聚合规则',
  };
  return labels[type] || type;
}

/**
 * 获取机构类型显示名称
 */
export function getInstitutionTypeLabel(type: InstitutionType): string {
  const labels: Record<InstitutionType, string> = {
    county: '县/区',
    primary: '小学',
    middle: '初中',
    nine_year: '九年一贯制',
    complete: '完全中学',
    teaching_point: '教学点',
  };
  return labels[type] || type;
}

/**
 * 获取条件操作符显示名称
 */
export function getConditionOperatorLabel(op: ConditionOperator): string {
  const labels: Record<ConditionOperator, string> = {
    equals: '等于',
    not_equals: '不等于',
    in: '在列表中',
    not_in: '不在列表中',
    greater_than: '大于',
    less_than: '小于',
    greater_equal: '大于等于',
    less_equal: '小于等于',
    between: '介于',
    is_null: '为空',
    is_not_null: '不为空',
  };
  return labels[op] || op;
}

/**
 * 获取阈值操作符显示名称
 */
export function getThresholdOperatorLabel(op: ThresholdOperator): string {
  const labels: Record<ThresholdOperator, string> = {
    '>=': '大于等于',
    '>': '大于',
    '<=': '小于等于',
    '<': '小于',
    '==': '等于',
    '!=': '不等于',
    between: '介于',
  };
  return labels[op] || op;
}

/**
 * 获取达标状态标签
 */
export function getComplianceStatusLabel(isCompliant: boolean | null): string {
  if (isCompliant === true) return '达标';
  if (isCompliant === false) return '未达标';
  return '待判定';
}

/**
 * 获取达标状态颜色
 */
export function getComplianceStatusColor(isCompliant: boolean | null): string {
  if (isCompliant === true) return 'success';
  if (isCompliant === false) return 'error';
  return 'default';
}

/**
 * 格式化差异系数
 */
export function formatCV(cv: number | null): string {
  if (cv === null || cv === undefined) return '-';
  return cv.toFixed(4);
}

/**
 * 格式化达标率
 */
export function formatComplianceRate(rate: number | null): string {
  if (rate === null || rate === undefined) return '-';
  return `${rate.toFixed(2)}%`;
}
