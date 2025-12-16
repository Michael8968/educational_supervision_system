import React, { useState, useEffect } from 'react';
import { Button, Table, Space, message, Modal, Form, Input, Select, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import styles from './index.module.css';
import {
  getSchools,
  createSchool,
  updateSchool,
  deleteSchool,
  School,
  SCHOOL_TYPES,
  SCHOOL_CATEGORIES,
  URBAN_RURAL_TYPES,
} from '../../../services/schoolService';

const { Search } = Input;

const SchoolManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<School[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<{
    keyword: string;
    schoolType: string;
    status: string;
  }>({
    keyword: '',
    schoolType: '',
    status: '',
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [current, setCurrent] = useState<School | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getSchools({
        keyword: filters.keyword || undefined,
        schoolType: filters.schoolType || undefined,
        status: filters.status || undefined,
        page,
        pageSize,
      });
      setDataSource(response.list);
      setTotal(response.total);
    } catch (error) {
      console.error('加载学校数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters.schoolType, filters.status]);

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, keyword: value }));
    setPage(1);
    setTimeout(() => loadData(), 0);
  };

  const handleCreate = async (values: any) => {
    try {
      await createSchool(values);
      message.success('创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      loadData();
    } catch (e: unknown) {
      message.error((e as Error).message || '创建失败');
    }
  };

  const openEdit = (record: School) => {
    setCurrent(record);
    editForm.setFieldsValue({
      code: record.code,
      name: record.name,
      schoolType: record.schoolType,
      schoolCategory: record.schoolCategory,
      urbanRural: record.urbanRural,
      address: record.address,
      principal: record.principal,
      contactPhone: record.contactPhone,
      studentCount: record.studentCount,
      teacherCount: record.teacherCount,
      status: record.status,
    });
    setEditOpen(true);
  };

  const handleEdit = async (values: any) => {
    if (!current) return;
    try {
      await updateSchool(current.id, values);
      message.success('保存成功');
      setEditOpen(false);
      editForm.resetFields();
      setCurrent(null);
      loadData();
    } catch (e: unknown) {
      message.error((e as Error).message || '保存失败');
    }
  };

  const handleDelete = (record: School) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除学校 "${record.name}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteSchool(record.id);
          message.success('删除成功');
          loadData();
        } catch (e: unknown) {
          message.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  const handleStatusChange = async (record: School, newStatus: 'active' | 'inactive') => {
    try {
      await updateSchool(record.id, { status: newStatus });
      message.success(newStatus === 'active' ? '启用成功' : '停用成功');
      loadData();
    } catch (e: unknown) {
      message.error((e as Error).message || '更新状态失败');
    }
  };

  const columns: ColumnsType<School> = [
    {
      title: '学校编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '学校名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '学校类型',
      dataIndex: 'schoolType',
      key: 'schoolType',
      width: 120,
    },
    {
      title: '办学性质',
      dataIndex: 'schoolCategory',
      key: 'schoolCategory',
      width: 100,
    },
    {
      title: '城乡类型',
      dataIndex: 'urbanRural',
      key: 'urbanRural',
      width: 100,
    },
    {
      title: '校长',
      dataIndex: 'principal',
      key: 'principal',
      width: 100,
    },
    {
      title: '联系电话',
      dataIndex: 'contactPhone',
      key: 'contactPhone',
      width: 130,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record: School) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          {record.status === 'active' ? (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleStatusChange(record, 'inactive')}
            >
              停用
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={() => handleStatusChange(record, 'active')}
            >
              启用
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.schoolManagement}>
      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          <h3>学校列表</h3>
          <div className={styles.filters}>
            <Select
              style={{ width: 140 }}
              placeholder="学校类型"
              allowClear
              value={filters.schoolType || undefined}
              options={SCHOOL_TYPES}
              onChange={(v) => setFilters(prev => ({ ...prev, schoolType: v || '' }))}
            />
            <Select
              style={{ width: 120 }}
              placeholder="状态筛选"
              allowClear
              value={filters.status || undefined}
              options={[
                { label: '启用', value: 'active' },
                { label: '停用', value: 'inactive' },
              ]}
              onChange={(v) => setFilters(prev => ({ ...prev, status: v || '' }))}
            />
            <Search
              placeholder="搜索学校名称/编码"
              allowClear
              onSearch={handleSearch}
              style={{ width: 240 }}
            />
          </div>
          <div className={styles.actions}>
            <Button onClick={loadData}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新增学校
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          rowKey="id"
          pagination={{
            total,
            current: page,
            pageSize,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条数据`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1200 }}
        />
      </div>

      {/* 新增学校 */}
      <Modal
        title="新增学校"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item name="code" label="学校编码" rules={[{ required: true, message: '请输入学校编码' }]}>
            <Input placeholder="请输入学校编码" />
          </Form.Item>
          <Form.Item name="name" label="学校名称" rules={[{ required: true, message: '请输入学校名称' }]}>
            <Input placeholder="请输入学校名称" />
          </Form.Item>
          <Form.Item name="schoolType" label="学校类型" rules={[{ required: true, message: '请选择学校类型' }]}>
            <Select options={SCHOOL_TYPES} placeholder="请选择学校类型" />
          </Form.Item>
          <Form.Item name="schoolCategory" label="办学性质">
            <Select options={SCHOOL_CATEGORIES} placeholder="请选择办学性质" allowClear />
          </Form.Item>
          <Form.Item name="urbanRural" label="城乡类型">
            <Select options={URBAN_RURAL_TYPES} placeholder="请选择城乡类型" allowClear />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input placeholder="请输入学校地址" />
          </Form.Item>
          <Form.Item name="principal" label="校长">
            <Input placeholder="请输入校长姓名" />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="studentCount" label="学生人数">
            <Input type="number" placeholder="请输入学生人数" />
          </Form.Item>
          <Form.Item name="teacherCount" label="教师人数">
            <Input type="number" placeholder="请输入教师人数" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); createForm.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit">确认</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑学校 */}
      <Modal
        title={current ? `编辑学校：${current.name}` : '编辑学校'}
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          editForm.resetFields();
          setCurrent(null);
        }}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="code" label="学校编码" rules={[{ required: true, message: '请输入学校编码' }]}>
            <Input placeholder="请输入学校编码" />
          </Form.Item>
          <Form.Item name="name" label="学校名称" rules={[{ required: true, message: '请输入学校名称' }]}>
            <Input placeholder="请输入学校名称" />
          </Form.Item>
          <Form.Item name="schoolType" label="学校类型" rules={[{ required: true, message: '请选择学校类型' }]}>
            <Select options={SCHOOL_TYPES} placeholder="请选择学校类型" />
          </Form.Item>
          <Form.Item name="schoolCategory" label="办学性质">
            <Select options={SCHOOL_CATEGORIES} placeholder="请选择办学性质" allowClear />
          </Form.Item>
          <Form.Item name="urbanRural" label="城乡类型">
            <Select options={URBAN_RURAL_TYPES} placeholder="请选择城乡类型" allowClear />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input placeholder="请输入学校地址" />
          </Form.Item>
          <Form.Item name="principal" label="校长">
            <Input placeholder="请输入校长姓名" />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item name="studentCount" label="学生人数">
            <Input type="number" placeholder="请输入学生人数" />
          </Form.Item>
          <Form.Item name="teacherCount" label="教师人数">
            <Input type="number" placeholder="请输入教师人数" />
          </Form.Item>
          <Form.Item name="status" label="状态">
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
    </div>
  );
};

export default SchoolManagement;
