/**
 * 专家端 API 服务
 */

import { get } from './api';

// ==================== 类型定义 ====================

// 审核统计
export interface ReviewStats {
  total: number;
  submitted: number;
  approved: number;
  rejected: number;
  completed: number;
  completionRate: number;
}

// 专家项目
export interface ExpertProject {
  id: string;
  name: string;
  description?: string;
  status: string;
  assessmentType?: '普及普惠' | '优质均衡';
  startDate?: string;
  endDate?: string;
  createdAt: string;
  reviewStats: ReviewStats;
}

// 汇总统计
export interface SummaryStats {
  totalProjects: number;
  totalSubmitted: number;
  totalApproved: number;
  totalRejected: number;
  totalCompleted: number;
  totalRecords: number;
  overallCompletionRate: number;
}

// 专家项目列表响应
export interface ExpertProjectsResponse {
  projects: ExpertProject[];
  summary: SummaryStats;
}

// 区县统计
export interface DistrictStats {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
  completed: number;
  completionRate: number;
}

// 区县信息
export interface DistrictInfo {
  districtId: string;
  districtName: string;
  districtCode?: string;
  schoolCount: number;
  stats: DistrictStats;
}

// 区县统计响应
export interface DistrictStatsResponse {
  project: {
    id: string;
    name: string;
    assessmentType?: string;
  };
  districts: DistrictInfo[];
  summary: {
    totalSchools: number;
    totalRecords: number;
    totalSubmitted: number;
    totalApproved: number;
    totalRejected: number;
    totalCompleted: number;
    overallCompletionRate: number;
  };
}

// 填报记录（专家视角）
export interface ExpertSubmission {
  id: string;
  projectId: string;
  formId: string;
  schoolId?: string;
  submitterId?: string;
  submitterName?: string;
  submitterOrg?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  rejectReason?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  formName?: string;
  formTarget?: string;
  schoolName?: string;
  schoolCode?: string;
  schoolType?: string;
  districtId?: string;
  districtName?: string;
}

// 填报记录列表响应
export interface ExpertSubmissionsResponse {
  submissions: ExpertSubmission[];
  stats: {
    total: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
}

// 表单信息
export interface FormInfo {
  id: string;
  name: string;
  target?: string;
  type?: string;
}

// 区县下拉选项
export interface DistrictOption {
  id: string;
  name: string;
  code?: string;
}

// ==================== API 函数 ====================

/**
 * 获取当前专家负责的项目列表
 */
export async function getExpertProjects(): Promise<ExpertProjectsResponse> {
  return get<ExpertProjectsResponse>('/expert/projects');
}

/**
 * 获取项目详情（专家视角）
 */
export async function getExpertProject(projectId: string): Promise<ExpertProject> {
  return get<ExpertProject>(`/expert/projects/${projectId}`);
}

/**
 * 获取项目下按区县的审核统计
 */
export async function getProjectDistrictStats(projectId: string): Promise<DistrictStatsResponse> {
  return get<DistrictStatsResponse>(`/expert/projects/${projectId}/district-stats`);
}

/**
 * 获取项目下的填报记录列表
 */
export async function getProjectSubmissions(
  projectId: string,
  filters?: {
    districtId?: string;
    formId?: string;
    status?: string;
    keyword?: string;
  }
): Promise<ExpertSubmissionsResponse> {
  const params: Record<string, string> = {};
  if (filters?.districtId) params.districtId = filters.districtId;
  if (filters?.formId) params.formId = filters.formId;
  if (filters?.status) params.status = filters.status;
  if (filters?.keyword) params.keyword = filters.keyword;

  return get<ExpertSubmissionsResponse>(`/expert/projects/${projectId}/submissions`, params);
}

/**
 * 获取项目下的表单列表（用于筛选下拉）
 */
export async function getProjectForms(projectId: string): Promise<FormInfo[]> {
  return get<FormInfo[]>(`/expert/projects/${projectId}/forms`);
}

/**
 * 获取项目下的区县列表（用于筛选下拉）
 */
export async function getProjectDistricts(projectId: string): Promise<DistrictOption[]> {
  return get<DistrictOption[]>(`/expert/projects/${projectId}/districts`);
}
