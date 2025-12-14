/**
 * 状态管理统一导出
 */

// Auth Store
export {
  useAuthStore,
  useUserPermissions,
  selectIsAuthenticated,
  selectUser,
  selectToken,
  selectIsLoading as selectAuthLoading,
  selectError as selectAuthError,
} from './authStore';
export type { User, UserRole, LoginCredentials } from './authStore';

// Project Store
export {
  useProjectStore,
  useProjectsByStatus,
  selectProjects,
  selectCurrentProject,
  selectIsLoading as selectProjectLoading,
  selectError as selectProjectError,
  selectFilters,
} from './projectStore';
export type { ProjectStatus, ProjectFilters } from './projectStore';

// UI Store
export {
  useUIStore,
  selectSidebar,
  selectTheme,
  selectGlobalLoading,
  selectBreadcrumbs,
  selectPageTitle,
} from './uiStore';
export type { Theme } from './uiStore';
