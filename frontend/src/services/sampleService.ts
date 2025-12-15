// 项目样本管理 API 服务

import { get, post, put, del } from './api';

// 样本配置类型
export interface SampleConfig {
  projectId: string;
  district: boolean;
  school: boolean;
  grade: boolean;
  class: boolean;
  student: boolean;
  parent: boolean;
  department: boolean;
  teacher: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 样本类型
export interface Sample {
  id: string;
  projectId: string;
  parentId: string | null;
  type: 'district' | 'school' | 'teacher' | 'grade' | 'class' | 'student';
  code: string;
  name: string;
  schoolType?: string;
  teacherSampleMode?: 'self' | 'assigned';
  phone?: string;
  idCard?: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  children?: Sample[];
}

// 样本统计类型
export interface SampleStats {
  total: number;
  district: number;
  school: number;
  teacher: number;
  grade: number;
  class: number;
  student: number;
}

// 导入结果类型
export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

// ==================== 配置相关 ====================

// 获取项目样本配置
export async function getSampleConfig(projectId: string): Promise<SampleConfig> {
  return get<SampleConfig>(`/projects/${projectId}/samples/config`);
}

// 更新项目样本配置
export async function updateSampleConfig(
  projectId: string,
  config: Partial<SampleConfig>
): Promise<void> {
  return put(`/projects/${projectId}/samples/config`, config);
}

// ==================== 样本数据相关 ====================

// 获取项目样本数据（树形结构）
export async function getSamples(
  projectId: string,
  params?: { type?: string }
): Promise<Sample[]> {
  return get<Sample[]>(`/projects/${projectId}/samples`, params as Record<string, string>);
}

// 获取项目样本数据（平铺列表）
export async function getSampleList(
  projectId: string,
  params?: { type?: string; parentId?: string }
): Promise<Sample[]> {
  return get<Sample[]>(`/projects/${projectId}/samples/list`, params as Record<string, string>);
}

// 添加区县样本
export async function addDistrictSample(
  projectId: string,
  data: { code?: string; name: string }
): Promise<{ id: string }> {
  return post<{ id: string }>(`/projects/${projectId}/samples/districts`, data);
}

// 添加学校样本
export async function addSchoolSample(
  projectId: string,
  data: {
    parentId?: string;
    code?: string;
    name: string;
    schoolType?: string;
    teacherSampleMode?: 'self' | 'assigned';
  }
): Promise<{ id: string }> {
  return post<{ id: string }>(`/projects/${projectId}/samples/schools`, data);
}

// 添加教师样本
export async function addTeacherSample(
  projectId: string,
  data: {
    parentId: string;
    name: string;
    phone?: string;
    idCard?: string;
  }
): Promise<{ id: string }> {
  return post<{ id: string }>(`/projects/${projectId}/samples/teachers`, data);
}

// 更新样本
export async function updateSample(
  projectId: string,
  id: string,
  data: Partial<Sample>
): Promise<void> {
  return put(`/projects/${projectId}/samples/${id}`, data);
}

// 删除样本（级联删除子样本）
export async function deleteSample(projectId: string, id: string): Promise<void> {
  return del(`/projects/${projectId}/samples/${id}`);
}

// 批量导入样本
export async function importSamples(
  projectId: string,
  type: 'district' | 'school' | 'teacher',
  samples: Array<Partial<Sample>>
): Promise<ImportResult> {
  return post<ImportResult>(`/projects/${projectId}/samples/import`, { type, samples });
}

// 获取样本统计
export async function getSampleStats(projectId: string): Promise<SampleStats> {
  return get<SampleStats>(`/projects/${projectId}/samples/stats`);
}

// ==================== 辅助函数 ====================

// 根据类型获取中文名称
export const sampleTypeMap: Record<string, string> = {
  district: '区县',
  school: '学校',
  teacher: '教师',
  grade: '年级',
  class: '班级',
  student: '学生',
  parent: '家长',
  department: '部门',
};

// 教师填报模式映射
export const teacherModeMap: Record<string, string> = {
  self: '自行填报',
  assigned: '指定填报',
};
