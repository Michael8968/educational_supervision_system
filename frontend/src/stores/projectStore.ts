/**
 * 项目状态管理
 * 使用 Zustand 管理项目相关状态
 */

import { create } from 'zustand';
import {
  getProjects,
  getById,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
} from '../services/projectService';
import type { Project } from '../services/projectService';

// 项目状态类型
export type ProjectStatus = '配置中' | '填报中' | '评审中' | '已中止' | '已完成';

// 项目筛选条件
export interface ProjectFilters {
  status?: ProjectStatus;
  year?: string;
  keyword?: string;
}

// 项目状态接口
interface ProjectState {
  // 状态
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  filters: ProjectFilters;

  // 操作
  fetchProjects: (filters?: ProjectFilters) => Promise<void>;
  fetchProjectById: (id: string) => Promise<Project | null>;
  createProject: (project: Partial<Project>) => Promise<Project | null>;
  updateProject: (id: string, project: Partial<Project>) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  setCurrentProject: (project: Project | null) => void;
  setFilters: (filters: ProjectFilters) => void;
  clearError: () => void;
}

/**
 * 项目状态 Store
 */
export const useProjectStore = create<ProjectState>((set, get) => ({
  // 初始状态
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  filters: {},

  // 获取项目列表
  fetchProjects: async (filters?: ProjectFilters) => {
    set({ isLoading: true, error: null });

    try {
      const mergedFilters = { ...get().filters, ...filters };
      const projects = await getProjects(mergedFilters as { status?: string });

      set({
        projects,
        filters: mergedFilters,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '获取项目列表失败',
      });
    }
  },

  // 获取单个项目
  fetchProjectById: async (id: string): Promise<Project | null> => {
    set({ isLoading: true, error: null });

    try {
      const project = await getById(id);
      set({
        currentProject: project,
        isLoading: false,
      });
      return project;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '获取项目详情失败',
      });
      return null;
    }
  },

  // 创建项目
  createProject: async (project: Partial<Project>): Promise<Project | null> => {
    set({ isLoading: true, error: null });

    try {
      const result = await apiCreateProject(project);
      // 重新获取列表
      await get().fetchProjects();
      set({ isLoading: false });
      return result as Project;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '创建项目失败',
      });
      return null;
    }
  },

  // 更新项目
  updateProject: async (id: string, project: Partial<Project>): Promise<boolean> => {
    set({ isLoading: true, error: null });

    try {
      await apiUpdateProject(id, project);
      // 更新本地状态
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, ...project } : p
        ),
        currentProject:
          state.currentProject?.id === id
            ? { ...state.currentProject, ...project }
            : state.currentProject,
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '更新项目失败',
      });
      return false;
    }
  },

  // 删除项目
  deleteProject: async (id: string): Promise<boolean> => {
    set({ isLoading: true, error: null });

    try {
      await apiDeleteProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject:
          state.currentProject?.id === id ? null : state.currentProject,
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : '删除项目失败',
      });
      return false;
    }
  },

  // 设置当前项目
  setCurrentProject: (project: Project | null) => {
    set({ currentProject: project });
  },

  // 设置筛选条件
  setFilters: (filters: ProjectFilters) => {
    set({ filters });
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },
}));

/**
 * 选择器
 */
export const selectProjects = (state: ProjectState) => state.projects;
export const selectCurrentProject = (state: ProjectState) => state.currentProject;
export const selectIsLoading = (state: ProjectState) => state.isLoading;
export const selectError = (state: ProjectState) => state.error;
export const selectFilters = (state: ProjectState) => state.filters;

/**
 * 按状态筛选项目
 */
export const useProjectsByStatus = (status: ProjectStatus) => {
  return useProjectStore((state) =>
    state.projects.filter((p) => p.status === status)
  );
};
