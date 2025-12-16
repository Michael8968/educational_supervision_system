// API 基础配置

const API_BASE_URL = 'http://localhost:3001/api';

function getAuthToken(): string | null {
  // 兼容旧逻辑：如果存在单独的 token key，优先使用
  const direct = localStorage.getItem('token');
  if (direct) return direct;

  // 兼容 Zustand persist：token 存在 auth-storage.state.token
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

// 通用请求方法
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ code: number; data?: T; message?: string }> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // 添加认证token
  const token = getAuthToken();
  if (token) {
    (defaultHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// GET 请求
export async function get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url = `${endpoint}?${searchParams.toString()}`;
  }
  const response = await request<T>(url);
  return response.data as T;
}

// POST 请求
export async function post<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await request<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.data as T;
}

// PUT 请求
export async function put<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await request<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.data as T;
}

// DELETE 请求
export async function del<T>(endpoint: string): Promise<T> {
  const response = await request<T>(endpoint, {
    method: 'DELETE',
  });
  return response.data as T;
}

export { API_BASE_URL };
