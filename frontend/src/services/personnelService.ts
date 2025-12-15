// 项目人员管理 API 服务

import { get, post, put, del } from './api';

// 人员类型
export interface Personnel {
  id: string;
  projectId: string;
  name: string;
  organization: string;
  phone: string;
  idCard: string;
  role: 'leader' | 'member' | 'expert' | 'observer';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// 人员统计类型
export interface PersonnelStats {
  total: number;
  leader: number;
  member: number;
  expert: number;
  observer: number;
}

// 导入结果类型
export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

// 获取项目人员列表
export async function getPersonnel(
  projectId: string,
  params?: { role?: string; status?: string }
): Promise<Personnel[]> {
  return get<Personnel[]>(`/projects/${projectId}/personnel`, params as Record<string, string>);
}

// 获取单个人员
export async function getPersonnelById(projectId: string, id: string): Promise<Personnel> {
  return get<Personnel>(`/projects/${projectId}/personnel/${id}`);
}

// 添加人员
export async function addPersonnel(
  projectId: string,
  data: Partial<Personnel>
): Promise<{ id: string }> {
  return post<{ id: string }>(`/projects/${projectId}/personnel`, data);
}

// 更新人员
export async function updatePersonnel(
  projectId: string,
  id: string,
  data: Partial<Personnel>
): Promise<void> {
  return put(`/projects/${projectId}/personnel/${id}`, data);
}

// 删除人员
export async function deletePersonnel(projectId: string, id: string): Promise<void> {
  return del(`/projects/${projectId}/personnel/${id}`);
}

// 批量导入人员
export async function importPersonnel(
  projectId: string,
  personnel: Array<Partial<Personnel>>
): Promise<ImportResult> {
  return post<ImportResult>(`/projects/${projectId}/personnel/import`, { personnel });
}

// 获取人员统计
export async function getPersonnelStats(projectId: string): Promise<PersonnelStats> {
  return get<PersonnelStats>(`/projects/${projectId}/personnel/stats`);
}

// 角色映射
export const roleMap: Record<string, string> = {
  leader: '组长',
  member: '成员',
  expert: '专家',
  observer: '观察员',
};

// 反向角色映射
export const roleReverseMap: Record<string, string> = {
  '组长': 'leader',
  '成员': 'member',
  '专家': 'expert',
  '观察员': 'observer',
};
