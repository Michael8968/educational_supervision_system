/**
 * 学前教育普及普惠督导评估统计服务
 *
 * 提供前端调用后端学前教育统计API的接口
 */

const API_BASE_URL = '/api/preschool-statistics';

/**
 * 达标等级类型
 */
export type ComplianceLevel = 'compliant' | 'basic' | 'non-compliant' | 'pending';

/**
 * 学前双普等级类型
 */
export type PreschoolLevel = 'excellence' | 'improved' | 'consolidated' | 'non-compliant';

/**
 * 指标数据
 */
export interface IndicatorData {
  code: string;
  name: string;
  value: number | null;
  unit: string;
  threshold: number;
  operator: string;
  complianceLevel: ComplianceLevel;
  isCompliant: boolean;
  isBasic: boolean;
  isPending: boolean;
}

/**
 * 指标汇总统计
 */
export interface IndicatorSummary {
  totalCount: number;
  compliantCount: number;
  basicCount: number;
  nonCompliantCount: number;
  pendingCount: number;
  allCompliant: boolean;
}

/**
 * 区县信息
 */
export interface DistrictInfo {
  id: string;
  code: string;
  name: string;
}

/**
 * 填报信息
 */
export interface SubmissionInfo {
  id: string;
  status: string;
  submittedAt: string;
}

/**
 * 普及普惠水平指标汇总响应
 */
export interface UniversalizationSummary {
  district: DistrictInfo;
  submission?: SubmissionInfo;
  indicators: IndicatorData[];
  summary: IndicatorSummary;
  message?: string;
}

/**
 * 学前双普等级信息
 */
export interface PreschoolComplianceLevel {
  level: PreschoolLevel;
  name: string;
  description: string;
}

/**
 * 指标达标评估
 */
export interface IndicatorEvaluation {
  code: string;
  name: string;
  complianceLevel: ComplianceLevel;
}

/**
 * 学前双普配置
 */
export interface PreschoolComplianceConfig {
  totalIndicators: number;
  levels: {
    consolidated: {
      name: string;
      minCompliant: number;
      maxBasicCompliant: number;
    };
    improved: {
      name: string;
      minCompliant: number;
      maxBasicCompliant: number;
    };
    excellence: {
      name: string;
      minCompliant: number;
      maxBasicCompliant: number;
    };
  };
}

/**
 * 综合达标情况响应
 */
export interface OverallComplianceResponse {
  district: DistrictInfo;
  submission?: SubmissionInfo;
  indicators: IndicatorEvaluation[];
  summary: IndicatorSummary;
  complianceLevel: PreschoolComplianceLevel | null;
  config: PreschoolComplianceConfig;
  message?: string;
}

/**
 * 幼儿园信息
 */
export interface KindergartenInfo {
  id: string;
  code: string;
  name: string;
  kindergartenType: string;
  kindergartenLevel: string;
  studentCount: number;
  teacherCount: number;
  classCount: number;
  urbanRural: string;
}

/**
 * 幼儿园统计汇总
 */
export interface KindergartenSummary {
  total: number;
  byType: {
    public: number;
    inclusivePrivate: number;
    nonInclusivePrivate: number;
  };
  byUrbanRural: {
    urban: number;
    town: number;
    rural: number;
  };
  students: {
    total: number;
    public: number;
    inclusivePrivate: number;
    publicRatio?: string;
    inclusiveCoverage?: string;
  };
  teachers: number;
  classes: number;
}

/**
 * 幼儿园汇总响应
 */
export interface KindergartenSummaryResponse {
  project: {
    id: string;
    name: string;
  };
  kindergartens: KindergartenInfo[];
  summary: KindergartenSummary;
}

/**
 * 获取区县普及普惠水平指标汇总（3项指标）
 *
 * @param districtId - 区县ID
 * @param projectId - 项目ID
 * @returns Promise<UniversalizationSummary>
 */
export async function getUniversalizationSummary(
  districtId: string,
  projectId: string
): Promise<UniversalizationSummary> {
  const response = await fetch(
    `${API_BASE_URL}/districts/${districtId}/universalization-summary?projectId=${projectId}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '获取普及普惠水平指标汇总失败');
  }

  return response.json();
}

/**
 * 获取区县学前教育普及普惠综合达标情况和等级判定
 *
 * @param districtId - 区县ID
 * @param projectId - 项目ID
 * @returns Promise<OverallComplianceResponse>
 */
export async function getOverallCompliance(
  districtId: string,
  projectId: string
): Promise<OverallComplianceResponse> {
  const response = await fetch(
    `${API_BASE_URL}/districts/${districtId}/overall-compliance?projectId=${projectId}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '获取综合达标情况失败');
  }

  return response.json();
}

/**
 * 获取项目下所有幼儿园的统计汇总
 *
 * @param projectId - 项目ID
 * @returns Promise<KindergartenSummaryResponse>
 */
export async function getKindergartenSummary(
  projectId: string
): Promise<KindergartenSummaryResponse> {
  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}/kindergarten-summary`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '获取幼儿园汇总统计失败');
  }

  return response.json();
}

/**
 * 获取达标等级的显示文本
 */
export function getComplianceLevelText(level: ComplianceLevel): string {
  const textMap: Record<ComplianceLevel, string> = {
    compliant: '合格',
    basic: '基本合格',
    'non-compliant': '不合格',
    pending: '待填报'
  };
  return textMap[level] || '未知';
}

/**
 * 获取达标等级的颜色
 */
export function getComplianceLevelColor(level: ComplianceLevel): string {
  const colorMap: Record<ComplianceLevel, string> = {
    compliant: 'success',
    basic: 'warning',
    'non-compliant': 'error',
    pending: 'default'
  };
  return colorMap[level] || 'default';
}

/**
 * 获取学前双普等级的显示文本
 */
export function getPreschoolLevelText(level: PreschoolLevel): string {
  const textMap: Record<PreschoolLevel, string> = {
    excellence: '创优"学前双普"',
    improved: '提高"学前双普"',
    consolidated: '巩固"学前双普"',
    'non-compliant': '未达标'
  };
  return textMap[level] || '未知';
}

/**
 * 获取学前双普等级的颜色
 */
export function getPreschoolLevelColor(level: PreschoolLevel): string {
  const colorMap: Record<PreschoolLevel, string> = {
    excellence: 'success',
    improved: 'primary',
    consolidated: 'info',
    'non-compliant': 'error'
  };
  return colorMap[level] || 'default';
}
