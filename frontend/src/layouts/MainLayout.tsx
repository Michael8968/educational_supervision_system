import React, { useState, useMemo } from 'react';
import { Layout, Menu, Dropdown, Space, Tag } from 'antd';
import {
  HomeOutlined,
  SettingOutlined,
  LogoutOutlined,
  FormOutlined,
  AuditOutlined,
  FileTextOutlined,
  TeamOutlined,
  DownOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet, Navigate } from 'react-router-dom';
import { useAuthStore, useUserPermissions, UserRole, ScopeItem } from '../stores/authStore';
import styles from './MainLayout.module.css';

const { Header, Sider, Content } = Layout;

// 角色名称映射
const roleNameMap: Record<string, string> = {
  admin: '系统管理员',
  city_admin: '市级管理员',
  district_admin: '区县管理员',
  school_reporter: '学校填报员',
  project_manager: '项目管理员',
  collector: '数据采集员',
  expert: '评估专家',
  decision_maker: '报告决策者',
};

// 角色标签颜色
const roleColorMap: Record<string, string> = {
  admin: 'red',
  city_admin: 'purple',
  district_admin: 'blue',
  school_reporter: 'green',
  project_manager: 'blue',
  collector: 'green',
  expert: 'orange',
  decision_maker: 'purple',
};

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const { user, isAuthenticated, logout, switchRole, setCurrentScope } = useAuthStore();
  const permissions = useUserPermissions();

  // 根据角色生成菜单项
  const menuItems = useMemo(() => {
    const items = [];

    // 教育督导 - 管理员和项目管理员可见完整内容
    if (permissions.canManageProjects) {
      items.push({
        key: '/home',
        icon: <HomeOutlined />,
        label: '教育督导',
      });
    }

    // 区县工作台 - 区县管理员专用入口
    if (permissions.isDistrictAdmin && !permissions.isAdmin) {
      items.push({
        key: '/district',
        icon: <BankOutlined />,
        label: '区县工作台',
      });
    }

    // 数据填报 - 采集员专用入口
    if (permissions.isCollector && !permissions.isAdmin) {
      items.push({
        key: '/collector',
        icon: <FormOutlined />,
        label: '数据填报',
      });
    }

    // 专家评审 - 专家专用入口
    if (permissions.isExpert && !permissions.isAdmin) {
      items.push({
        key: '/expert',
        icon: <AuditOutlined />,
        label: '专家评审',
      });
    }

    // 报告查看 - 决策者专用入口
    if (permissions.isDecisionMaker && !permissions.isAdmin) {
      items.push({
        key: '/reports',
        icon: <FileTextOutlined />,
        label: '评估报告',
      });
    }

    // 系统配置 - 仅管理员可见
    if (permissions.canManageSystem) {
      items.push({
        key: '/system',
        icon: <SettingOutlined />,
        label: '系统配置',
      });
    }

    // 用户管理 - 仅管理员可见（含子菜单）
    if (permissions.canManageSystem) {
      items.push({
        key: '/users',
        icon: <TeamOutlined />,
        label: '用户管理',
        children: [
          {
            key: '/users/school-account',
            label: '学校&账号管理',
          },
          {
            key: '/users/expert-account',
            label: '专家账号管理',
          },
        ],
      });
    }

    return items;
  }, [permissions]);

  const handleMenuClick = (e: { key: string }) => {
    navigate(e.key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 获取默认路由（根据角色）
  const getDefaultRouteByRole = (role: UserRole) => {
    if (role === 'admin' || role === 'project_manager') return '/home';
    if (role === 'city_admin') return '/home';
    if (role === 'district_admin') return '/district';
    if (role === 'collector' || role === 'school_reporter') return '/collector';
    if (role === 'expert') return '/expert';
    if (role === 'decision_maker') return '/reports';
    return '/home';
  };

  const getDefaultRoute = () => getDefaultRouteByRole(user!.role);

  const handleSwitchRole = (nextRole: UserRole) => {
    if (!user) return;
    if (nextRole === user.role) return;
    switchRole(nextRole);
    // 角色切换后，为避免落到无权限页面，直接跳转到该角色默认入口
    navigate(getDefaultRouteByRole(nextRole));
  };

  const handleSwitchRoleWithScope = (nextRole: UserRole, scope: ScopeItem) => {
    if (!user) return;
    switchRole(nextRole);
    setCurrentScope(scope);
    navigate(getDefaultRouteByRole(nextRole));
  };

  // 未登录重定向到登录页
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const userMenuItems = (() => {
    const roles = (user?.roles && user.roles.length > 0 ? user.roles : user?.role ? [user.role] : []) as UserRole[];
    const scopes = Array.isArray(user?.scopes) ? user!.scopes! : [];
    const districtScopes = scopes.filter(s => s.type === 'district');
    const schoolScopes = scopes.filter(s => s.type === 'school');

    const roleItems = roles.map((r) => {
      // 区县管理员：二级子菜单展示区县
      if (r === 'district_admin') {
        const children = (districtScopes.length > 0 ? districtScopes : []).map((s) => ({
          key: `role:${r}:district:${s.id}`,
          label: (
            <Space>
              <span>{s.name}</span>
              {user?.role === r && user?.currentScope?.type === 'district' && user?.currentScope?.id === s.id
                ? <Tag color="blue">当前</Tag>
                : null}
            </Space>
          ),
          onClick: () => handleSwitchRoleWithScope(r, s),
        }));

        return {
          key: `role:${r}`,
          label: (
            <Space>
              <span>{roleNameMap[r] || r}</span>
              {user?.role === r && user?.currentScope?.type === 'district'
                ? <span style={{ color: '#999' }}>（{user.currentScope.name}）</span>
                : null}
            </Space>
          ),
          children: children.length > 0 ? children : [{
            key: `role:${r}:empty`,
            disabled: true,
            label: '未配置区县范围',
          }],
        };
      }

      // 学校填报员：二级子菜单展示学校
      if (r === 'school_reporter') {
        const children = (schoolScopes.length > 0 ? schoolScopes : []).map((s) => ({
          key: `role:${r}:school:${s.id}`,
          label: (
            <Space>
              <span>{s.name}</span>
              {user?.role === r && user?.currentScope?.type === 'school' && user?.currentScope?.id === s.id
                ? <Tag color="green">当前</Tag>
                : null}
            </Space>
          ),
          onClick: () => handleSwitchRoleWithScope(r, s),
        }));

        return {
          key: `role:${r}`,
          label: (
            <Space>
              <span>{roleNameMap[r] || r}</span>
              {user?.role === r && user?.currentScope?.type === 'school'
                ? <span style={{ color: '#999' }}>（{user.currentScope.name}）</span>
                : null}
            </Space>
          ),
          children: children.length > 0 ? children : [{
            key: `role:${r}:empty`,
            disabled: true,
            label: '未配置学校范围',
          }],
        };
      }

      // 其他角色：保持一层
      return {
        key: `role:${r}`,
        label: (
          <Space>
            <span>{roleNameMap[r] || r}</span>
            {user?.role === r ? <Tag color={roleColorMap[r] || 'default'}>当前</Tag> : null}
          </Space>
        ),
        onClick: () => {
          setCurrentScope(null);
          handleSwitchRole(r);
        },
      };
    });

    return [
      ...roleItems,
      ...(roleItems.length > 0 ? [{ type: 'divider' as const }] : []),
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ];
  })();

  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/home')) return '/home';
    if (path.startsWith('/district')) return '/district';
    if (path.startsWith('/collector')) return '/collector';
    if (path.startsWith('/expert')) return '/expert';
    if (path.startsWith('/reports')) return '/reports';
    if (path.startsWith('/system')) return '/system';
    if (path.startsWith('/users/school-account')) return '/users/school-account';
    if (path.startsWith('/users/expert-account')) return '/users/expert-account';
    if (path.startsWith('/users')) return '/users/school-account';
    return menuItems[0]?.key || '/home';
  };

  // 获取展开的子菜单
  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/users')) return ['/users'];
    return [];
  };

  return (
    <Layout className={styles.mainLayout}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className={styles.mainSider}
        theme="light"
      >
        <div className={styles.logo} onClick={() => navigate(getDefaultRoute())}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="#1890ff">
            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
          </svg>
          {!collapsed && <span className={styles.logoText}>沈阳市教育督导系统</span>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header className={styles.mainHeader}>
          <div className={styles.headerRight}>
            <Space className={styles.userInfo}>
              <Tag color={roleColorMap[user.role] || 'default'}>
                {user.roleName || roleNameMap[user.role] || user.role}
                {user.currentScope?.name ? `（${user.currentScope.name}）` : ''}
              </Tag>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
                <Space style={{ cursor: 'pointer' }}>
                  <span>{user.username}</span>
                  <DownOutlined />
                </Space>
              </Dropdown>
            </Space>
          </div>
        </Header>
        <Content className={styles.mainContent}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
