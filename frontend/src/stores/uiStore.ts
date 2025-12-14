/**
 * UI 状态管理
 * 管理全局 UI 状态，如侧边栏、主题、全局加载状态等
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 主题类型
export type Theme = 'light' | 'dark';

// 侧边栏状态
interface SidebarState {
  collapsed: boolean;
  width: number;
}

// UI 状态接口
interface UIState {
  // 侧边栏
  sidebar: SidebarState;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // 主题
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // 全局加载
  globalLoading: boolean;
  loadingText: string;
  setGlobalLoading: (loading: boolean, text?: string) => void;

  // 面包屑
  breadcrumbs: { title: string; path?: string }[];
  setBreadcrumbs: (breadcrumbs: { title: string; path?: string }[]) => void;

  // 页面标题
  pageTitle: string;
  setPageTitle: (title: string) => void;
}

/**
 * UI 状态 Store
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // 侧边栏初始状态
      sidebar: {
        collapsed: false,
        width: 240,
      },

      toggleSidebar: () =>
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            collapsed: !state.sidebar.collapsed,
          },
        })),

      setSidebarCollapsed: (collapsed: boolean) =>
        set((state) => ({
          sidebar: {
            ...state.sidebar,
            collapsed,
          },
        })),

      // 主题初始状态
      theme: 'light',

      setTheme: (theme: Theme) => set({ theme }),

      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),

      // 全局加载状态
      globalLoading: false,
      loadingText: '',

      setGlobalLoading: (loading: boolean, text: string = '') =>
        set({
          globalLoading: loading,
          loadingText: text,
        }),

      // 面包屑
      breadcrumbs: [],

      setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),

      // 页面标题
      pageTitle: '',

      setPageTitle: (title: string) => {
        set({ pageTitle: title });
        // 同时更新文档标题
        document.title = title ? `${title} - 教育督导系统` : '教育督导系统';
      },
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebar: state.sidebar,
        theme: state.theme,
      }),
    }
  )
);

/**
 * 选择器
 */
export const selectSidebar = (state: UIState) => state.sidebar;
export const selectTheme = (state: UIState) => state.theme;
export const selectGlobalLoading = (state: UIState) => state.globalLoading;
export const selectBreadcrumbs = (state: UIState) => state.breadcrumbs;
export const selectPageTitle = (state: UIState) => state.pageTitle;
