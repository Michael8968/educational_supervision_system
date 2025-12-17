import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Radio, message, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores';
import styles from './index.module.css';

interface RoleOption {
  key: string;
  name: string;
  description: string;
  username: string;
  password: string;
}

const roles: RoleOption[] = [
  { key: 'admin', name: '系统管理员', description: '创建和管理项目，配置项目人员', username: 'AAA', password: 'BBB' },
  { key: 'project_manager', name: '项目管理员', description: '负责项目配置和管理', username: '111', password: '222' },
  { key: 'collector', name: '数据采集员', description: '负责数据填报和采集', username: '333', password: '444' },
  { key: 'expert', name: '项目评估专家', description: '负责项目评审和评估', username: '555', password: '666' },
  { key: 'decision_maker', name: '报告决策者', description: '查看评估报告和决策', username: '777', password: '888' },
];

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [selectedRole, setSelectedRole] = useState<string>('');

  // 使用 Zustand auth store
  const { login, isAuthenticated, isLoading, error, clearError, user } = useAuthStore();

  const getDefaultRouteByRole = (role?: string) => {
    if (role === 'admin' || role === 'project_manager') return '/home';
    if (role === 'city_admin' || role === 'district_admin') return '/home';
    if (role === 'collector' || role === 'school_reporter') return '/collector';
    if (role === 'expert') return '/expert';
    if (role === 'decision_maker') return '/reports';
    return '/home';
  };

  // 如果已登录，重定向到首页
  useEffect(() => {
    if (isAuthenticated) {
      navigate(getDefaultRouteByRole(user?.role), { replace: true });
    }
  }, [isAuthenticated, user?.role, navigate]);

  // 显示错误信息
  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError]);

  const handleRoleSelect = (role: RoleOption) => {
    setSelectedRole(role.key);
    form.setFieldsValue({
      username: role.username,
      password: role.password,
    });
  };

  const handleLogin = async (values: { username: string; password: string }) => {
    const success = await login(values);
    if (success) {
      message.success('登录成功');
      // 按当前角色跳转到默认入口
      navigate(getDefaultRouteByRole(useAuthStore.getState().user?.role), { replace: true });
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginHeader}>
        <div className={styles.loginLogo}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="#1890ff">
            <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
          </svg>
        </div>
        <h1 className={styles.loginTitle}>沈阳市教育督导系统</h1>
        <p className={styles.loginSubtitle}>Educational Supervision System</p>
      </div>

      <div className={styles.loginContent}>
        <Spin spinning={isLoading} tip="登录中...">
          <div className={styles.loginFormCard}>
            <h2 className={styles.formTitle}>用户登录</h2>
            <p className={styles.formDesc}>请输入用户名和密码登录系统</p>

            <Form
              form={form}
              onFinish={handleLogin}
              layout="vertical"
            >
              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" size="large" disabled={isLoading} />
              </Form.Item>

              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password placeholder="请输入密码" size="large" disabled={isLoading} />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
                  登录
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Spin>

        <div className={styles.quickLoginCard}>
          <h2 className={styles.formTitle}>快速登录</h2>
          <p className={styles.formDesc}>点击测试账号直接登录，或选择角色后手动输入用户名密码</p>

          <Radio.Group
            value={selectedRole}
            onChange={e => {
              const role = roles.find(r => r.key === e.target.value);
              if (role) handleRoleSelect(role);
            }}
            className={styles.roleList}
            disabled={isLoading}
          >
            {roles.map(role => (
              <div
                key={role.key}
                className={`${styles.roleItem} ${selectedRole === role.key ? styles.roleItemSelected : ''}`}
                onClick={() => !isLoading && handleRoleSelect(role)}
              >
                <Radio value={role.key}>
                  <div className={styles.roleInfo}>
                    <span className={styles.roleName}>{role.name}</span>
                    <span className={styles.roleDesc}>{role.description}</span>
                  </div>
                </Radio>
                <div className={styles.roleCredentials}>
                  <span className={styles.credentialTag}>{role.username}</span>
                  <span className={styles.credentialTag}>{role.password}</span>
                </div>
              </div>
            ))}
          </Radio.Group>
        </div>
      </div>
    </div>
  );
};

export default Login;
