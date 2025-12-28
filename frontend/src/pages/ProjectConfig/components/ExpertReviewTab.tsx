/**
 * 数据审核 Tab 组件
 * 供项目管理员审核提交的数据（批准/驳回）
 *
 * 注意：原"专家审核任务分配"功能已移除
 * 评估专家将使用新的"评估功能"进行专业评估
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Table,
  Tag,
  Card,
  Statistic,
  Row,
  Col,
  Empty,
  Spin,
  message,
  Space,
  Progress,
  Select,
  Input,
  Modal,
  Form,
  Tooltip,
  Badge,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  UserOutlined,
  ReloadOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as submissionService from '../../../services/submissionService';
import type { Personnel } from '../types';
import styles from '../index.module.css';

interface ExpertReviewTabProps {
  projectId: string;
  projectStatus: string;
  personnel?: Record<string, Personnel[]>;
  disabled?: boolean;
}

interface SubmissionRecord {
  id: string;
  formId: string;
  formName?: string;
  toolName?: string;
  submitterName?: string;
  submitterOrg?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedAt?: string;
  approvedAt?: string;
  rejectReason?: string;
}

interface ReviewStats {
  total: number;
  submitted: number;
  approved: number;
  rejected: number;
  draft: number;
}

const ExpertReviewTab: React.FC<ExpertReviewTabProps> = ({
  projectId,
  projectStatus,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('submitted');
  const [keyword, setKeyword] = useState('');

  // 驳回弹窗
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null);
  const [rejectForm] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const submissionList = await submissionService.getSubmissions({
        projectId,
        status: statusFilter || undefined,
      });
      setSubmissions(submissionList as unknown as SubmissionRecord[]);

      // 计算统计
      const allList = await submissionService.getSubmissions({ projectId });

      const statsData: ReviewStats = {
        total: allList.length,
        submitted: allList.filter((s: SubmissionRecord) => s.status === 'submitted').length,
        approved: allList.filter((s: SubmissionRecord) => s.status === 'approved').length,
        rejected: allList.filter((s: SubmissionRecord) => s.status === 'rejected').length,
        draft: allList.filter((s: SubmissionRecord) => s.status === 'draft').length,
      };
      setStats(statsData);
    } catch (error) {
      console.error('加载数据失败:', error);
      setStats({ total: 0, submitted: 0, approved: 0, rejected: 0, draft: 0 });
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 过滤数据
  const filteredSubmissions = submissions.filter(s => {
    const matchKeyword = !keyword ||
      s.submitterName?.includes(keyword) ||
      s.submitterOrg?.includes(keyword) ||
      s.toolName?.includes(keyword);
    return matchKeyword;
  });

  // 批准
  const handleApprove = async (submission: SubmissionRecord) => {
    Modal.confirm({
      title: '确认批准',
      content: `确定批准 "${submission.submitterName || submission.submitterOrg || '未知'}" 的填报记录吗？`,
      okText: '批准',
      cancelText: '取消',
      onOk: async () => {
        setActionLoading(true);
        try {
          await submissionService.approveSubmission(submission.id);
          message.success('批准成功');
          loadData();
        } catch (error) {
          message.error('批准失败');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  // 打开驳回弹窗
  const handleOpenReject = (submission: SubmissionRecord) => {
    setSelectedSubmission(submission);
    rejectForm.resetFields();
    setRejectModalVisible(true);
  };

  // 驳回
  const handleReject = async (values: { reason: string }) => {
    if (!selectedSubmission) return;

    setActionLoading(true);
    try {
      await submissionService.rejectSubmission(selectedSubmission.id, values.reason);
      message.success('驳回成功');
      setRejectModalVisible(false);
      loadData();
    } catch (error) {
      message.error('驳回失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 查看详情
  const handleViewDetail = (submission: SubmissionRecord) => {
    window.open(`/data-entry/${submission.id}`, '_blank');
  };

  // 表格列定义
  const columns: ColumnsType<SubmissionRecord> = [
    {
      title: '采集工具',
      key: 'tool',
      render: (_, record) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span>{record.toolName || record.formName || '未知工具'}</span>
        </Space>
      ),
    },
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
      ellipsis: true,
      width: 150,
      render: (org) => org || '-',
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const statusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
          draft: { color: 'default', text: '草稿', icon: null },
          submitted: { color: 'processing', text: '待审核', icon: <ClockCircleOutlined /> },
          approved: { color: 'success', text: '已通过', icon: <CheckCircleOutlined /> },
          rejected: { color: 'error', text: '已驳回', icon: <CloseCircleOutlined /> },
        };
        const config = statusMap[record.status] || statusMap.draft;
        return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          {record.status === 'submitted' && !disabled && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record)}
              >
                批准
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenReject(record)}
              >
                驳回
              </Button>
            </>
          )}
          {record.status === 'rejected' && record.rejectReason && (
            <Tooltip title={`驳回原因: ${record.rejectReason}`}>
              <Tag color="error">已驳回</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 项目未到评审阶段
  if (projectStatus === '配置中') {
    return (
      <div className={styles.expertReviewTab}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="项目尚在配置中，暂无审核数据"
        >
          <p style={{ color: '#999' }}>请先完成项目配置并启动填报后再进行审核</p>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.expertReviewTab}>
      {/* 统计卡片 */}
      {stats && (
        <Card className={styles.statsCard} size="small">
          <Row gutter={24}>
            <Col span={5}>
              <Statistic
                title="待审核"
                value={stats.submitted}
                suffix="条"
                valueStyle={{ color: '#1890ff' }}
                prefix={<Badge status="processing" />}
              />
            </Col>
            <Col span={5}>
              <Statistic
                title="已通过"
                value={stats.approved}
                suffix="条"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={5}>
              <Statistic
                title="已驳回"
                value={stats.rejected}
                suffix="条"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="总提交"
                value={stats.total - stats.draft}
                suffix="条"
              />
            </Col>
            <Col span={5}>
              <div className={styles.progressCard}>
                <span className={styles.progressLabel}>审核完成度</span>
                <Progress
                  percent={
                    (stats.total - stats.draft) > 0
                      ? Math.round(((stats.approved + stats.rejected) / (stats.total - stats.draft)) * 100)
                      : 0
                  }
                  status={stats.submitted > 0 ? 'active' : 'success'}
                  size="small"
                />
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* 筛选和操作栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div className={styles.filterBar}>
          <Space>
            <Select
              placeholder="状态筛选"
              style={{ width: 120 }}
              allowClear
              value={statusFilter || undefined}
              onChange={(val) => setStatusFilter(val || '')}
            >
              <Select.Option value="submitted">待审核</Select.Option>
              <Select.Option value="approved">已通过</Select.Option>
              <Select.Option value="rejected">已驳回</Select.Option>
            </Select>
            <Input
              placeholder="搜索填报人/单位/工具"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
          </Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </div>
      </Card>

      {/* 列表 */}
      <Card>
        <Spin spinning={loading}>
          {filteredSubmissions.length > 0 ? (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={filteredSubmissions}
              pagination={{
                total: filteredSubmissions.length,
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条记录`,
                showSizeChanger: true,
              }}
              scroll={{ x: 1000 }}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                statusFilter || keyword
                  ? '没有符合条件的记录'
                  : '暂无提交记录'
              }
            />
          )}
        </Spin>
      </Card>

      {/* 驳回原因弹窗 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            驳回填报
          </Space>
        }
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        footer={null}
        width={480}
      >
        <p style={{ marginBottom: 16 }}>
          驳回 <strong>{selectedSubmission?.submitterName || selectedSubmission?.submitterOrg}</strong> 的填报记录，请填写驳回原因：
        </p>
        <Form form={rejectForm} onFinish={handleReject} layout="vertical">
          <Form.Item
            name="reason"
            label="驳回原因"
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <Input.TextArea
              placeholder="请输入驳回原因，填报人将收到此反馈"
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setRejectModalVisible(false)}>取消</Button>
              <Button type="primary" danger htmlType="submit" loading={actionLoading}>
                确认驳回
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpertReviewTab;
