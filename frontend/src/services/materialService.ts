import { API_BASE_URL, del, get } from './api';

// ==================== 类型定义（供 MaterialUploader 等组件使用）====================

export interface SubmissionMaterial {
  id: string;
  submissionId: string;
  materialConfigId?: string | null;
  indicatorId?: string | null;
  fileName: string;
  filePath?: string;
  fileSize: number;
  fileType: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;

  // join supporting_materials 的字段（后端 GET /submissions/:id/materials 返回）
  materialCode?: string | null;
  materialName?: string | null;
  allowedTypes?: string | null;
  maxSize?: string | null;
}

export interface MaterialConfig {
  id: string;
  code: string;
  name: string;
  fileTypes: string; // e.g. "pdf,docx,*"
  maxSize: string;   // e.g. "20MB"
  description?: string | null;
  required?: number; // 0/1
}

export interface MaterialRequirementGroup {
  indicatorId: string;
  indicatorName: string;
  indicatorCode: string;
  materials: MaterialConfig[];
}

// DataEntryForm 用：上传成功回填的最小信息
export interface UploadedMaterial {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

function getAuthToken(): string | null {
  const direct = localStorage.getItem('token');
  if (direct) return direct;

  const raw = localStorage.getItem('auth-storage');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: { token?: unknown } } | null;
    const token = parsed?.state?.token;
    return typeof token === 'string' ? token : null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.message || `HTTP error! status: ${res.status}`);
  }
  return payload as T;
}

/**
 * 上传佐证材料（单文件）
 * 后端：POST /api/submissions/:submissionId/materials  (multipart/form-data; field name = "file")
 */
export async function uploadMaterial(
  submissionId: string,
  file: File,
  extra?: {
    materialConfigId?: string;
    indicatorId?: string;
    description?: string;
  }
): Promise<UploadedMaterial> {
  const { materialConfigId, indicatorId, description } = extra || {};

  const formData = new FormData();
  formData.append('file', file);
  if (materialConfigId) formData.append('materialConfigId', materialConfigId);
  if (indicatorId) formData.append('indicatorId', indicatorId);
  if (description) formData.append('description', description);

  const token = getAuthToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const url = `${API_BASE_URL}/submissions/${submissionId}/materials`;
  const payload = await fetchJson<{ code: number; data: UploadedMaterial; message?: string }>(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  return payload.data;
}

// ==================== 查询/删除/下载 ====================

// 获取填报的佐证资料列表：GET /api/submissions/:submissionId/materials
export async function getMaterials(submissionId: string): Promise<SubmissionMaterial[]> {
  return get<SubmissionMaterial[]>(`/submissions/${submissionId}/materials`);
}

// 获取工具表单的佐证资料要求：GET /api/tools/:toolId/material-requirements
export async function getToolMaterialRequirements(toolId: string): Promise<MaterialRequirementGroup[]> {
  return get<MaterialRequirementGroup[]>(`/tools/${toolId}/material-requirements`);
}

// 删除佐证材料：DELETE /api/materials/:id
export async function deleteMaterial(materialId: string): Promise<void> {
  await del(`/materials/${materialId}`);
}

/**
 * 下载佐证材料（直接用于 window.open / a.href）
 * 后端：GET /api/materials/:id/download
 */
export function getDownloadUrl(materialId: string): string {
  return `${API_BASE_URL}/materials/${materialId}/download`;
}

// ==================== 工具函数 ====================

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let idx = 0;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx += 1;
  }
  return `${v.toFixed(idx === 0 ? 0 : 2)}${units[idx]}`;
}

export function getFileIconType(mimeTypeOrName: string): 'pdf' | 'word' | 'excel' | 'ppt' | 'zip' | 'image' | 'other' {
  const s = (mimeTypeOrName || '').toLowerCase();
  if (s.includes('pdf') || s.endsWith('.pdf')) return 'pdf';
  if (s.includes('word') || s.endsWith('.doc') || s.endsWith('.docx')) return 'word';
  if (s.includes('excel') || s.endsWith('.xls') || s.endsWith('.xlsx') || s.endsWith('.csv')) return 'excel';
  if (s.includes('powerpoint') || s.endsWith('.ppt') || s.endsWith('.pptx')) return 'ppt';
  if (s.includes('zip') || s.includes('rar') || s.includes('7z') || s.endsWith('.zip') || s.endsWith('.rar') || s.endsWith('.7z')) return 'zip';
  if (s.startsWith('image/') || s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.jpeg') || s.endsWith('.gif') || s.endsWith('.webp')) return 'image';
  return 'other';
}

export function validateFileType(file: File, allowed: string): boolean {
  const allow = (allowed || '').trim();
  if (!allow) return true;
  const parts = allow.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (parts.includes('*')) return true;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ext) return false;
  return parts.includes(ext);
}

function parseMaxBytes(maxSize: string): number | null {
  const m = (maxSize || '').trim().match(/^(\d+)\s*(KB|MB|GB)?$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || 'MB').toUpperCase();
  if (!Number.isFinite(n)) return null;
  if (unit === 'KB') return n * 1024;
  if (unit === 'MB') return n * 1024 * 1024;
  if (unit === 'GB') return n * 1024 * 1024 * 1024;
  return null;
}

export function validateFileSize(file: File, maxSize: string): boolean {
  const max = parseMaxBytes(maxSize);
  if (!max) return true;
  return file.size <= max;
}
