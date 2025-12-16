import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tag, message, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { createUser, deleteUser, getUsers, SystemUser, updateUser, ScopeItem } from '../../services/userService';
import { getDistricts, District } from '../../services/districtService';
import { getSchools, School } from '../../services/schoolService';
import styles from './index.module.css';

const { Search } = Input;

const statusTag = (status: SystemUser['status']) => {
  if (status === 'active') return <Tag color="green">启用</Tag>;
  return <Tag color="default">停用</Tag>;
};

// 专家专业领域选项
const expertiseOptions = [
  { label: '教育督导', value: '教育督导' },
  { label: '学校管理', value: '学校管理' },
  { label: '教育教学', value: '教育教学' },
  { label: '课程设计', value: '课程设计' },
  { label: '师资培训', value: '师资培训' },
  { label: '教育评估', value: '教育评估' },
];

// 构建带分组的选项
interface ScopeOption {
  value: string;
  label: string;
  type: 'city' | 'district' | 'school';
  id: string;
  name: string;
}

const ExpertAccountManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [experts, setExperts] = useState<SystemUser[]>([]);
  const [keyword, setKeyword] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [current, setCurrent] = useState<SystemUser | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  // 区县和学校数据
  const [districts, setDistricts] = useState<District[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      // 只获取专家角色的用户
      const list = await getUsers({ role: 'expert', keyword });
      setExperts(list);
    } catch (e: unknown) {
      message.error((e as Error).message || '加载专家列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadDistricts();
    loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDistricts = async () => {
    try {
      const list = await getDistricts();
      setDistricts(list);
    } catch (e) {
      console.error('加载区县列表失败', e);
    }
  };

  const loadSchools = async () => {
    try {
      const response = await getSchools({ pageSize: 1000 });
      setSchools(response.list);
    } catch (e) {
      console.error('加载学校列表失败', e);
    }
  };

  // 构建数据范围多选选项（带分组）
  const scopeOptions: { label: string; options: ScopeOption[] }[] = [
    {
      label: '市级',
      options: [
        { value: 'city:shenyang', label: '沈阳市', type: 'city', id: 'shenyang', name: '沈阳市' },
      ],
    },
    {
      label: '区县',
      options: districts.map(d => ({
        value: `district:${d.id}`,
        label: d.name,
        type: 'district' as const,
        id: d.id,
        name: d.name,
      })),
    },
    {
      label: '学校',
      options: schools.map(s => ({
        value: `school:${s.id}`,
        label: s.name,
        type: 'school' as const,
        id: s.id,
        name: s.name,
      })),
    },
  ];

  // 将选中的值转换为 ScopeItem 数组
  const valuesToScopes = (values: string[]): ScopeItem[] => {
    return values.map(v => {
      const [type, id] = v.split(':');
      let name = '';
      if (type === 'city') {
        name = '沈阳市';
      } else if (type === 'district') {
        name = districts.find(d => d.id === id)?.name || '';
      } else if (type === 'school') {
        name = schools.find(s => s.id === id)?.name || '';
      }
      return { type: type as ScopeItem['type'], id, name };
    });
  };

  // 将 ScopeItem 数组转换为选中的值
  const scopesToValues = (scopes: ScopeItem[]): string[] => {
    return scopes?.map(s => `${s.type}:${s.id}`) || [];
  };

  const handleSearch = (value: string) => {
    setKeyword(value);
    setTimeout(() => load(), 0);
  };

  const openEdit = (u: SystemUser) => {
    setCurrent(u);
    editForm.setFieldsValue({
      status: u.status,
      scopes: scopesToValues(u.scopes),
    });
    setEditOpen(true);
  };

  const openResetPassword = (u: SystemUser) => {
    setCurrent(u);
    pwdForm.resetFields();
    setPwdOpen(true);
  };

  const onCreate = async (values: {
    username: string;
    password: string;
    status?: SystemUser['status'];
    scopes?: string[];
  }) => {
    try {
      const { scopes: scopeValues, ...rest } = values;
      const scopes = scopeValues ? valuesToScopes(scopeValues) : [];
      // 专家角色固定为 expert
      await createUser({ ...rest, roles: ['expert'], scopes });
      message.success('创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch (e: unknown) {
      message.error((e as Error).message || '创建失败');
    }
  };

  const onSaveEdit = async (values: {
    status: SystemUser['status'];
    scopes?: string[];
  }) => {
    if (!current) return;
    try {
      const { scopes: scopeValues, ...rest } = values;
      const scopes = scopeValues ? valuesToScopes(scopeValues) : [];
      await updateUser(current.username, { ...rest, scopes });
      message.success('保存成功');
      setEditOpen(false);
      editForm.resetFields();
      setCurrent(null);
      load();
    } catch (e: unknown) {
      message.error((e as Error).message || '保存失败');
    }
  };

  const onResetPassword = async (values: { password: string }) => {
    if (!current) return;
    try {
      await updateUser(current.username, { password: values.password });
      message.success('密码已重置');
      setPwdOpen(false);
      pwdForm.resetFields();
      setCurrent(null);
    } catch (e: unknown) {
      message.error((e as Error).message || '重置失败');
    }
  };

  const onDelete = (u: SystemUser) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除专家账号 "${u.username}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteUser(u.username);
          message.success('删除成功');
          load();
        } catch (e: unknown) {
          message.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  // 渲染数据范围标签
  const renderScopes = (scopes: ScopeItem[]) => {
    if (!scopes || scopes.length === 0) return '-';

    const typeColors: Record<string, string> = {
      city: 'purple',
      district: 'blue',
      school: 'green',
    };

    const displayScopes = scopes.slice(0, 3);
    const remaining = scopes.length - 3;

    return (
      <Space size={[0, 4]} wrap>
        {displayScopes.map((s, i) => (
          <Tag key={i} color={typeColors[s.type] || 'default'}>{s.name}</Tag>
        ))}
        {remaining > 0 && <Tag>+{remaining}</Tag>}
      </Space>
    );
  };

  const columns: ColumnsType<SystemUser> = [
    {
      title: '用户名/专家名称',
      dataIndex: 'username',
      key: 'username',
      width: 150,
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: '评审范围',
      dataIndex: 'scopes',
      key: 'scopes',
      width: 280,
      render: (scopes: ScopeItem[]) => renderScopes(scopes),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: SystemUser['status']) => statusTag(s),
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 120 },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: SystemUser) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => openResetPassword(record)}>
            重置密码
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <ArrowLeftOutlined className={styles.backBtn} onClick={() => navigate(-1)} />
        <h2 className={styles.pageTitle}>专家账号管理</h2>
      </div>

      <Card>
        <div className={styles.toolbar}>
          <div className={styles.filters}>
            <Search
              placeholder="搜索专家用户名/名称"
              allowClear
              onSearch={handleSearch}
              style={{ width: 280 }}
            />
          </div>
          <div className={styles.actions}>
            <Button onClick={load}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新增专家
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={experts}
          rowKey="username"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
          scroll={{ x: 950 }}
        />
      </Card>

      {/* 新增专家 */}
      <Modal
        title="新增专家账号"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        footer={null}
        width={560}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={onCreate}
          initialValues={{ status: 'active' }}
        >
          <Form.Item name="username" label="用户名/专家名称" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名（用于登录和显示）" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }, { min: 2, message: '密码至少 2 位' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item name="expertise" label="专业领域">
            <Select
              mode="multiple"
              placeholder="请选择专业领域（可多选）"
              options={expertiseOptions}
              maxTagCount="responsive"
            />
          </Form.Item>
          <Form.Item name="scopes" label="评审范围" rules={[{ required: true, message: '请选择评审范围' }]}>
            <Select
              mode="multiple"
              placeholder="请选择评审范围（可多选）"
              options={scopeOptions}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              maxTagCount="responsive"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={[{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }]} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); createForm.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit">确认</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑专家 */}
      <Modal
        title={current ? `编辑专家：${current.username}` : '编辑专家'}
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          editForm.resetFields();
          setCurrent(null);
        }}
        footer={null}
        width={560}
      >
        <Form form={editForm} layout="vertical" onFinish={onSaveEdit}>
          <Form.Item name="expertise" label="专业领域">
            <Select
              mode="multiple"
              placeholder="请选择专业领域（可多选）"
              options={expertiseOptions}
              maxTagCount="responsive"
            />
          </Form.Item>
          <Form.Item name="scopes" label="评审范围" rules={[{ required: true, message: '请选择评审范围' }]}>
            <Select
              mode="multiple"
              placeholder="请选择评审范围（可多选）"
              options={scopeOptions}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              maxTagCount="responsive"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={[{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }]} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setEditOpen(false); editForm.resetFields(); setCurrent(null); }}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码 */}
      <Modal
        title={current ? `重置密码：${current.username}` : '重置密码'}
        open={pwdOpen}
        onCancel={() => {
          setPwdOpen(false);
          pwdForm.resetFields();
          setCurrent(null);
        }}
        footer={null}
      >
        <Form form={pwdForm} layout="vertical" onFinish={onResetPassword}>
          <Form.Item
            name="password"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }, { min: 2, message: '密码至少 2 位' }]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setPwdOpen(false); pwdForm.resetFields(); setCurrent(null); }}>取消</Button>
              <Button type="primary" htmlType="submit">确认</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpertAccountManagement;
