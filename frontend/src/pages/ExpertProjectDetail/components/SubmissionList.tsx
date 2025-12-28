/**
 * 填报记录列表Tab
 * 供评估专家查看填报数据（只读）
 * 审核功能已移交给项目管理员
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Select,
  Input,
  Empty,
  Spin,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as expertService from '../../../services/expertService';
import type { ExpertSubmission, FormInfo, DistrictOption } from '../../../services/expertService';

interface SubmissionListProps {
  projectId: string;
}

// 状态配置
const statusConfig: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  submitted: { color: 'processing', text: '待审核' },
  approved: { color: 'success', text: '已通过' },
  rejected: { color: 'error', text: '已驳回' },
};

const SubmissionList: React.FC<SubmissionListProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<ExpertSubmission[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    submitted: number;
    approved: number;
    rejected: number;
  } | null>(null);

  // 筛选条件
  const [districtId, setDistrictId] = useState<string>('');
  const [formId, setFormId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [keyword, setKeyword] = useState('');

  // 下拉选项
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [forms, setForms] = useState<FormInfo[]>([]);

  // 加载筛选选项
  const loadFilterOptions = useCallback(async () => {
    try {
      const [districtsData, formsData] = await Promise.all([
        expertService.getProjectDistricts(projectId),
        expertService.getProjectForms(projectId),
      ]);
      setDistricts(districtsData || []);
      setForms(formsData || []);
    } catch (error) {
      console.error('加载筛选选项失败:', error);
    }
  }, [projectId]);

  // 加载填报列表
  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await expertService.getProjectSubmissions(projectId, {
        districtId: districtId || undefined,
        formId: formId || undefined,
        status: status || undefined,
        keyword: keyword || undefined,
      });
      setSubmissions(response.submissions || []);
      setStats(response.stats || null);
    } catch (error) {
      console.error('加载填报列表失败:', error);
      setSubmissions([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, districtId, formId, status, keyword]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  // 查看详情
  const handleViewDetail = (submission: ExpertSubmission) => {
    window.open(`/data-entry/${submission.id}`, '_blank');
  };

  // 表格列定义
  const columns: ColumnsType<ExpertSubmission> = [
    {
      title: '填报人',
      key: 'submitter',
      width: 120,
      render: (_, record) => (
        <Space>
          <UserOutlined />
          <span>{record.submitterName || '未知'}</span>
        </Space>
      ),
    },
    {
      title: '填报单位',
      dataIndex: 'submitterOrg',
      key: 'submitterOrg',
      width: 150,
      ellipsis: true,
      render: (org) => org || '-',
    },
    {
      title: '区县',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 100,
      render: (name) => name || '-',
    },
    {
      title: '表单',
      dataIndex: 'formName',
      key: 'formName',
      width: 150,
      ellipsis: true,
      render: (name) => name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status) => {
        const config = statusConfig[status] || statusConfig.draft;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 150,
      render: (time) => (time ? new Date(time).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="选择区县"
            style={{ width: 140 }}
            allowClear
            value={districtId || undefined}
            onChange={(val) => setDistrictId(val || '')}
          >
            {districts.map((d) => (
              <Select.Option key={d.id} value={d.id}>
                {d.name}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="选择表单"
            style={{ width: 180 }}
            allowClear
            value={formId || undefined}
            onChange={(val) => setFormId(val || '')}
          >
            {forms.map((f) => (
              <Select.Option key={f.id} value={f.id}>
                {f.name}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="状态筛选"
            style={{ width: 120 }}
            allowClear
            value={status || undefined}
            onChange={(val) => setStatus(val || '')}
          >
            <Select.Option value="submitted">待审核</Select.Option>
            <Select.Option value="approved">已通过</Select.Option>
            <Select.Option value="rejected">已驳回</Select.Option>
          </Select>
          <Input
            placeholder="搜索填报人/单位"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 180 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={loadSubmissions}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* 列表区域 */}
      <Card
        title={`填报记录 (${stats?.total || 0} 条)`}
        extra={
          <Space>
            <Tag color="processing">待审核 {stats?.submitted || 0}</Tag>
            <Tag color="success">已通过 {stats?.approved || 0}</Tag>
            <Tag color="error">已驳回 {stats?.rejected || 0}</Tag>
          </Space>
        }
      >
        <Spin spinning={loading}>
          {submissions.length > 0 ? (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={submissions}
              pagination={{
                total: submissions.length,
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条记录`,
                showSizeChanger: true,
              }}
              scroll={{ x: 900 }}
              size="middle"
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                status || districtId || formId || keyword
                  ? '没有符合条件的记录'
                  : '暂无填报记录'
              }
            />
          )}
        </Spin>
      </Card>
    </>
  );
};

export default SubmissionList;
