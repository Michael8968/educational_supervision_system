import { get, post } from './api';

// 差异系数分析结果
export interface CVAnalysis {
  district: {
    id: string;
    name: string;
  };
  schoolType: string;
  schoolCount: number;
  cvIndicators: Record<string, {
    cv: number;
    mean: number;
    stdDev: number;
    count: number;
    name?: string;
  }>;
  cvComposite: number | null;
  threshold: number;
  isCompliant: boolean | null;
}

// 差异系数汇总
export interface CVSummary {
  cityTotal: {
    districtCount: number;
    compliantCount: number;
    avgCV: number | null;
  };
  districts: Array<{
    districtId: string;
    districtName: string;
    districtCode: string;
    schoolCount: number;
    cvComposite: number | null;
    threshold: number;
    isCompliant: boolean | null;
  }>;
}

// 达标率统计
export interface ComplianceStats {
  total: number;
  compliant: number;
  nonCompliant: number;
  pending: number;
  complianceRate: number | null;
}

// 类别达标率
export interface CategoryCompliance {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  total: number;
  compliant: number;
  complianceRate: number | null;
}

// 区县对比数据
export interface DistrictComparisonItem {
  districtId: string;
  districtName: string;
  districtCode: string;
  schoolCount: number;
  cvComposite: number | null;
  isCvCompliant: boolean | null;
  complianceRate: number | null;
  compliantCount: number;
  totalIndicators: number;
}

// 城乡对比数据
export interface UrbanRuralComparison {
  urbanRuralType: string;
  schoolCount: number;
  avgStudentTeacherRatio: number | null;
  cvStudentTeacherRatio: number | null;
}

// ==================== 差异系数分析 ====================

// 获取区县差异系数分析
export async function getCVAnalysis(
  projectId: string,
  districtId: string,
  schoolType?: string
): Promise<CVAnalysis> {
  const params: Record<string, string> = { districtId };
  if (schoolType) params.schoolType = schoolType;
  return get<CVAnalysis>(`/projects/${projectId}/cv-analysis`, params);
}

// 获取所有区县差异系数汇总
export async function getCVSummary(
  projectId: string,
  schoolType?: string
): Promise<CVSummary> {
  const params: Record<string, string> = {};
  if (schoolType) params.schoolType = schoolType;
  return get<CVSummary>(`/projects/${projectId}/cv-summary`, params);
}

// ==================== 达标率统计 ====================

// 获取达标率统计
export async function getComplianceSummary(
  projectId: string,
  options?: { districtId?: string; schoolId?: string }
): Promise<ComplianceStats> {
  return get<ComplianceStats>(`/projects/${projectId}/compliance-summary`, options as Record<string, string>);
}

// 获取各类别达标率
export async function getComplianceByCategory(
  projectId: string,
  districtId?: string
): Promise<CategoryCompliance[]> {
  const params: Record<string, string> = {};
  if (districtId) params.districtId = districtId;
  return get<CategoryCompliance[]>(`/projects/${projectId}/compliance-by-category`, params);
}

// ==================== 对比分析 ====================

// 获取区县对比数据
export async function getDistrictComparison(
  projectId: string,
  schoolType?: string
): Promise<DistrictComparisonItem[]> {
  const params: Record<string, string> = {};
  if (schoolType) params.schoolType = schoolType;
  return get<DistrictComparisonItem[]>(`/projects/${projectId}/district-comparison`, params);
}

// 获取城乡对比数据
export async function getUrbanRuralComparison(
  projectId: string,
  districtId?: string
): Promise<UrbanRuralComparison[]> {
  const params: Record<string, string> = {};
  if (districtId) params.districtId = districtId;
  return get<UrbanRuralComparison[]>(`/projects/${projectId}/urban-rural-comparison`, params);
}

// ==================== 统计快照 ====================

// 刷新区县统计
export async function refreshStatistics(
  projectId: string,
  districtId?: string,
  schoolType?: string
): Promise<void> {
  return post(`/projects/${projectId}/refresh-statistics`, { districtId, schoolType });
}

// 获取区县统计快照
export async function getDistrictStatistics(
  projectId: string,
  options?: { districtId?: string; schoolType?: string }
): Promise<Array<{
  id: string;
  project_id: string;
  district_id: string;
  district_name: string;
  district_code: string;
  school_type: string;
  school_count: number;
  cv_composite: number | null;
  is_cv_compliant: number | null;
  resource_compliance_rate: number | null;
  calculated_at: string;
}>> {
  return get(`/projects/${projectId}/district-statistics`, options as Record<string, string>);
}

// ==================== 学校指标数据 ====================

// 保存学校指标数据
export async function saveSchoolIndicatorData(data: {
  projectId: string;
  schoolId: string;
  dataIndicatorId: string;
  value?: number;
  textValue?: string;
  submissionId?: string;
}): Promise<void> {
  return post('/school-indicator-data', data);
}

// 批量保存学校指标数据
export async function saveSchoolIndicatorDataBatch(data: {
  projectId: string;
  schoolId: string;
  submissionId?: string;
  data: Array<{
    dataIndicatorId: string;
    value?: number;
    textValue?: string;
  }>;
}): Promise<void> {
  return post('/school-indicator-data/batch', data);
}

// ==================== 资源配置7项指标汇总 ====================

// 单项差异系数指标
export interface CVIndicatorSummary {
  code: string;
  name: string;
  unit: string;
  cv: number | null;
  mean: number | null;
  stdDev: number | null;
  count: number;
  threshold: number;
  isCompliant: boolean | null;
}

// 学校单项指标
export interface SchoolIndicatorValue {
  value: number | null;
  threshold: number;
  isCompliant: boolean | null;
}

// 学校资源配置指标汇总
export interface SchoolResourceIndicators {
  id: string;
  code: string;
  name: string;
  schoolType: string;
  studentCount: number;
  indicators: {
    L1: SchoolIndicatorValue;
    L2: SchoolIndicatorValue;
    L3: SchoolIndicatorValue;
    L4: SchoolIndicatorValue;
    L5: SchoolIndicatorValue;
    L6: SchoolIndicatorValue;
    L7: SchoolIndicatorValue;
  };
  compliantCount: number;
  totalCount: number;
  // 综合达标判定（至少6项达标，余项≥85%）
  isOverallCompliant: boolean | null;
  overallComplianceMessage: string;
  belowMinThresholdCount: number;
  overallComplianceDetails: string[];
}

// 学校综合达标统计
export interface OverallComplianceSummary {
  rule: string;
  minCompliantCount: number;
  minThresholdPercent: number;
  compliantSchools: number;
  nonCompliantSchools: number;
  pendingSchools: number;
  complianceRate: number | null;
  allSchoolsCompliant: boolean;
}

// 资源配置指标汇总响应
export interface ResourceIndicatorsSummary {
  district: {
    id: string;
    name: string;
    code: string;
  };
  schoolType: string;
  summary: {
    schoolCount: number;
    cvIndicators: CVIndicatorSummary[];
    compliantCvCount: number;
    totalCvCount: number;
    allCvCompliant: boolean | null;
    allCompliant: boolean | null;  // 向后兼容别名
    // 学校综合达标统计（至少6项达标，余项≥85%）
    overallCompliance: OverallComplianceSummary;
  };
  schools: SchoolResourceIndicators[];
}

// 获取区县资源配置7项指标汇总
export async function getResourceIndicatorsSummary(
  districtId: string,
  projectId: string,
  schoolType?: string
): Promise<ResourceIndicatorsSummary> {
  const params: Record<string, string> = { projectId };
  if (schoolType) params.schoolType = schoolType;
  return get<ResourceIndicatorsSummary>(`/districts/${districtId}/resource-indicators-summary`, params);
}

// ==================== 政府保障程度15项指标汇总 ====================

// 政府保障程度指标详情
export interface GovernmentGuaranteeIndicatorDetail {
  id?: string;
  name: string;
  value: number | string | null;
  displayValue: string;
  threshold?: number | string;
  unit?: string;
  isCompliant: boolean | null;
}

// 政府保障程度单项指标
export interface GovernmentGuaranteeIndicator {
  code: string;
  name: string;
  shortName: string;
  type: 'material' | 'boolean' | 'number' | 'comparison' | 'composite' | 'calculated';
  threshold: string | number;
  description: string;
  value: number | string | null;
  displayValue: string | null;
  isCompliant: boolean | null;
  details: GovernmentGuaranteeIndicatorDetail[];
}

// 政府保障程度指标汇总
export interface GovernmentGuaranteeSummary {
  totalCount: number;
  compliantCount: number;
  nonCompliantCount: number;
  pendingCount: number;
  allCompliant: boolean | null;
  complianceRate: number | null;
}

// 政府保障程度指标汇总响应
export interface GovernmentGuaranteeResponse {
  district: {
    id: string;
    name: string;
    code: string;
  };
  submission: {
    status: string | null;
    submittedAt: string | null;
  };
  summary: GovernmentGuaranteeSummary;
  indicators: GovernmentGuaranteeIndicator[];
}

// 获取区县政府保障程度15项指标汇总
export async function getGovernmentGuaranteeSummary(
  districtId: string,
  projectId: string
): Promise<GovernmentGuaranteeResponse> {
  const params: Record<string, string> = { projectId };
  return get<GovernmentGuaranteeResponse>(`/districts/${districtId}/government-guarantee-summary`, params);
}

// ==================== 教育质量指标汇总 ====================

// 教育质量指标详情
export interface EducationQualityIndicatorDetail {
  id?: string;
  name: string;
  value: number | string | null;
  displayValue: string;
  threshold?: number | string;
  unit?: string;
  isCompliant: boolean | null;
}

// 教育质量单项指标
export interface EducationQualityIndicator {
  code: string;
  name: string;
  shortName: string;
  type: 'calculated_district' | 'material' | 'quality_monitoring';
  threshold: string | number;
  description: string;
  value: number | string | null;
  displayValue: string | null;
  isCompliant: boolean | null;
  details: EducationQualityIndicatorDetail[];
}

// 教育质量指标汇总
export interface EducationQualitySummary {
  totalCount: number;
  compliantCount: number;
  nonCompliantCount: number;
  pendingCount: number;
  allCompliant: boolean | null;
  complianceRate: number | null;
}

// 教育质量指标汇总响应
export interface EducationQualityResponse {
  district: {
    id: string;
    name: string;
    code: string;
  };
  submission: {
    status: string | null;
    submittedAt: string | null;
  };
  summary: EducationQualitySummary;
  indicators: EducationQualityIndicator[];
}

// 获取区县教育质量指标汇总
export async function getEducationQualitySummary(
  districtId: string,
  projectId: string
): Promise<EducationQualityResponse> {
  const params: Record<string, string> = { projectId };
  return get<EducationQualityResponse>(`/districts/${districtId}/education-quality-summary`, params);
}

// ==================== 社会认可度指标汇总 ====================

// 社会认可度单项指标
export interface SocialRecognitionIndicator {
  code: string;
  name: string;
  shortName: string;
  type: 'boolean' | 'boolean_negative';
  threshold: string;
  description: string;
  value: string | null;
  displayValue: string | null;
  isCompliant: boolean | null;
  details: Array<{
    name: string;
    value: string | null;
    displayValue: string;
    isCompliant: boolean | null;
  }>;
}

// 社会认可度指标汇总
export interface SocialRecognitionSummary {
  totalCount: number;
  compliantCount: number;
  nonCompliantCount: number;
  pendingCount: number;
  allCompliant: boolean | null;
  complianceRate: number | null;
}

// 社会认可度指标汇总响应
export interface SocialRecognitionResponse {
  district: {
    id: string;
    name: string;
    code: string;
  };
  submission: {
    status: string | null;
    submittedAt: string | null;
  };
  summary: SocialRecognitionSummary;
  indicators: SocialRecognitionIndicator[];
}

// 获取区县社会认可度指标汇总
export async function getSocialRecognitionSummary(
  districtId: string,
  projectId: string
): Promise<SocialRecognitionResponse> {
  const params: Record<string, string> = { projectId };
  return get<SocialRecognitionResponse>(`/districts/${districtId}/social-recognition-summary`, params);
}
