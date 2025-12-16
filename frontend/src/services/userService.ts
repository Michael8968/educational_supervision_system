import { get, post, put, del } from './api';

export type UserRole = 'admin' | 'project_manager' | 'collector' | 'expert' | 'decision_maker';
export type UserStatus = 'active' | 'inactive';

export interface ScopeItem {
  type: 'city' | 'district' | 'school';
  id: string;
  name: string;
}

export interface SystemUser {
  username: string;
  roles: UserRole[];  // 支持多角色
  status: UserStatus;
  scopes: ScopeItem[];
  createdAt: string;
  updatedAt: string;
}

export async function getUsers(params?: {
  keyword?: string;
  role?: UserRole | '';  // 按单个角色筛选
  status?: UserStatus | '';
}): Promise<SystemUser[]> {
  const cleaned: Record<string, string> = {};
  if (params?.keyword) cleaned.keyword = params.keyword;
  if (params?.role) cleaned.role = params.role;
  if (params?.status) cleaned.status = params.status;
  return get<SystemUser[]>('/users', cleaned);
}

export async function createUser(data: {
  username: string;
  password: string;
  roles: UserRole[];  // 支持多角色
  status?: UserStatus;
  scopes?: ScopeItem[];
}): Promise<SystemUser> {
  return post<SystemUser>('/users', data);
}

export async function updateUser(
  username: string,
  data: Partial<{
    password: string;
    roles: UserRole[];  // 支持多角色
    status: UserStatus;
    scopes: ScopeItem[];
  }>
): Promise<SystemUser> {
  return put<SystemUser>(`/users/${encodeURIComponent(username)}`, data);
}

export async function deleteUser(username: string): Promise<void> {
  return del<void>(`/users/${encodeURIComponent(username)}`);
}

// 角色显示名称映射
export const roleDisplayNames: Record<UserRole, string> = {
  admin: '系统管理员',
  project_manager: '项目管理员',
  collector: '数据采集员',
  expert: '评估专家',
  decision_maker: '报告决策者',
};

// 账号管理页面使用的角色选项（不包含评估专家）
export const roleOptions: Array<{ label: string; value: UserRole }> = [
  { label: '系统管理员', value: 'admin' },
  { label: '项目管理员', value: 'project_manager' },
  { label: '数据采集员', value: 'collector' },
  { label: '报告决策者', value: 'decision_maker' },
];

// 所有角色选项（用于筛选等场景）
export const allRoleOptions: Array<{ label: string; value: UserRole }> = [
  { label: '系统管理员', value: 'admin' },
  { label: '项目管理员', value: 'project_manager' },
  { label: '数据采集员', value: 'collector' },
  { label: '评估专家', value: 'expert' },
  { label: '报告决策者', value: 'decision_maker' },
];


