/**
 * 专家区县详情页
 * 显示区县指标汇总和填报记录，支持审核操作
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Breadcrumb,
  Card,
  Tabs,
  Tag,
  Space,
  Spin,
  Button,
  Statistic,
  Row,
  Col,
  Table,
  Empty,
  message,
  Modal,
  Form,
  Input,
  Tooltip,
} from 'antd';
import {
  HomeOutlined,
  EnvironmentOutlined,
  BarChartOutlined,
  UnorderedListOutlined,
  ArrowLeftOutlined,
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as expertService from '../../services/expertService';
import * as submissionService from '../../services/submissionService';
import * as districtService from '../../services/districtService';
import type { ExpertProject } from '../../services/expertService';
import type { DistrictSubmission, DistrictSelfSubmission } from '../../services/districtService';
import BalancedIndicatorSummary from '../DistrictDashboard/components/BalancedIndicatorSummary';
import PreschoolIndicatorSummary from '../DistrictDashboard/components/PreschoolIndicatorSummary';
import styles from './index.module.css';

// 状态配置
const statusConfig: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  submitted: { color: 'processing', text: '待审核' },
  approved: { color: 'success', text: '已通过' },
  rejected: { color: 'error', text: '已驳回' },
};

// 通用填报记录类型
type SubmissionRecord = DistrictSubmission | DistrictSelfSubmission;

const ExpertDistrictDetail: React.FC = () => {
  const { projectId, districtId } = useParams<{ projectId: string; districtId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<ExpertProject | null>(null);
  const [districtInfo, setDistrictInfo] = useState<{ id: string; name: string } | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    submitted: number;
    approved: number;
    rejected: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState('indicators');
  const [refreshKey, setRefreshKey] = useState(0);

  // 填报列表状态
  const [schoolSubmissions, setSchoolSubmissions] = useState<DistrictSubmission[]>([]);
  const [districtSubmissions, setDistrictSubmissions] = useState<DistrictSelfSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // 驳回弹窗
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRecord | null>(null);
  const [rejectForm] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  // 加载项目和区县信息
  const loadBasicInfo = useCallback(async () => {
    if (!projectId || !districtId) return;

    setLoading(true);
    try {
      // 加载项目信息
      const projectData = await expertService.getExpertProject(projectId);
      setProject(projectData);

      // 加载区县统计
      const districtStats = await expertService.getProjectDistrictStats(projectId);
      const district = districtStats.districts.find((d) => d.districtId === districtId);
      if (district) {
        setDistrictInfo({ id: district.districtId, name: district.districtName });
        setStats(district.stats);
      }
    } catch (error) {
      console.error('加载信息失败:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, districtId]);

  // 加载学校填报记录
  const loadSchoolSubmissions = useCallback(async () => {
    if (!projectId || !districtId) return;

    setSubmissionsLoading(true);
    try {
      const response = await districtService.getDistrictSubmissions(districtId, projectId);
      setSchoolSubmissions(response.submissions || []);
    } catch (error) {
      console.error('加载学校填报失败:', error);
      setSchoolSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [projectId, districtId]);

  // 加载区县填报记录
  const loadDistrictSubmissions = useCallback(async () => {
    if (!projectId || !districtId) return;

    setSubmissionsLoading(true);
    try {
      const response = await districtService.getDistrictSelfSubmissions(districtId, projectId);
      setDistrictSubmissions(response.submissions || []);
    } catch (error) {
      console.error('加载区县填报失败:', error);
      setDistrictSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [projectId, districtId]);

  useEffect(() => {
    loadBasicInfo();
  }, [loadBasicInfo]);

  useEffect(() => {
    if (activeTab === 'schoolSubmissions') {
      loadSchoolSubmissions();
    } else if (activeTab === 'districtSubmissions') {
      loadDistrictSubmissions();
    }
  }, [activeTab, loadSchoolSubmissions, loadDistrictSubmissions]);

  // 查看详情
  const handleViewDetail = (submission: SubmissionRecord) => {
    window.open(`/data-entry/${submission.id}`, '_blank');
  };

  // 批准
  const handleApprove = async (submission: SubmissionRecord) => {
    Modal.confirm({
      title: '确认批准',
      content: `确定批准 "${submission.submitterName || '未知'}" 的填报记录吗？`,
      okText: '批准',
      cancelText: '取消',
      onOk: async () => {
        setActionLoading(true);
        try {
          await submissionService.approveSubmission(submission.id);
          message.success('批准成功');
          if (activeTab === 'schoolSubmissions') {
            loadSchoolSubmissions();
          } else {
            loadDistrictSubmissions();
          }
          setRefreshKey((k) => k + 1);
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
      if (activeTab === 'schoolSubmissions') {
        loadSchoolSubmissions();
      } else {
        loadDistrictSubmissions();
      }
      setRefreshKey((k) => k + 1);
    } catch (error) {
      message.error('驳回失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 表格列定义
  const getColumns = (showSchool: boolean): ColumnsType<SubmissionRecord> => [
    ...(showSchool
      ? [
          {
            title: '学校',
            dataIndex: 'schoolName',
            key: 'schoolName',
            width: 150,
            ellipsis: true,
            render: (name: string) => name || '-',
          },
        ]
      : []),
    {
      title: '填报人',
      key: 'submitter',
      width: 100,
      render: (_: unknown, record: SubmissionRecord) => (
        <Space>
          <UserOutlined />
          <span>{record.submitterName || '未知'}</span>
        </Space>
      ),
    },
    {
      title: '表单',
      dataIndex: 'formName',
      key: 'formName',
      width: 150,
      ellipsis: true,
      render: (name: string) => name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const config = statusConfig[status] || statusConfig.draft;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 150,
      render: (time: string) => (time ? new Date(time).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, record: SubmissionRecord) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          {record.status === 'submitted' && (
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
        </Space>
      ),
    },
  ];

  // 指标汇总组件
  const renderIndicatorSummary = () => {
    if (!districtId || !projectId) {
      return <Empty description="缺少必要参数" />;
    }

    if (project?.assessmentType === '普及普惠') {
      return (
        <PreschoolIndicatorSummary
          districtId={districtId}
          projectId={projectId}
          refreshKey={refreshKey}
        />
      );
    }

    return (
      <BalancedIndicatorSummary
        districtId={districtId}
        projectId={projectId}
        refreshKey={refreshKey}
      />
    );
  };

  const tabItems = [
    {
      key: 'indicators',
      label: (
        <span>
          <BarChartOutlined />
          指标汇总
        </span>
      ),
      children: renderIndicatorSummary(),
    },
    {
      key: 'schoolSubmissions',
      label: (
        <span>
          <BankOutlined />
          学校填报
        </span>
      ),
      children: (
        <Spin spinning={submissionsLoading}>
          {schoolSubmissions.length > 0 ? (
            <Table
              rowKey="id"
              columns={getColumns(true)}
              dataSource={schoolSubmissions}
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              scroll={{ x: 900 }}
              size="middle"
            />
          ) : (
            <Empty description="暂无学校填报记录" />
          )}
        </Spin>
      ),
    },
    {
      key: 'districtSubmissions',
      label: (
        <span>
          <UnorderedListOutlined />
          区县填报
        </span>
      ),
      children: (
        <Spin spinning={submissionsLoading}>
          {districtSubmissions.length > 0 ? (
            <Table
              rowKey="id"
              columns={getColumns(false)}
              dataSource={districtSubmissions}
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              scroll={{ x: 800 }}
              size="middle"
            />
          ) : (
            <Empty description="暂无区县填报记录" />
          )}
        </Spin>
      ),
    },
  ];

  return (
    <div className={styles.districtDetail}>
      {/* 面包屑导航 */}
      <Breadcrumb
        className={styles.breadcrumb}
        items={[
          {
            href: '/expert',
            title: (
              <>
                <HomeOutlined />
                <span>我的项目</span>
              </>
            ),
          },
          {
            href: `/expert/projects/${projectId}`,
            title: project?.name || '项目详情',
          },
          {
            title: (
              <>
                <EnvironmentOutlined />
                <span>{districtInfo?.name || '区县详情'}</span>
              </>
            ),
          },
        ]}
      />

      {/* 返回按钮 */}
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/expert/projects/${projectId}`)}
        className={styles.backButton}
      >
        返回项目详情
      </Button>

      <Spin spinning={loading}>
        {/* 区县信息头部 */}
        <Card className={styles.headerCard}>
          <Row gutter={24} align="middle">
            <Col flex="auto">
              <h1 className={styles.districtName}>
                <EnvironmentOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                {districtInfo?.name || '区县'}
              </h1>
              <p className={styles.projectName}>
                项目：{project?.name}
                {project?.assessmentType && (
                  <Tag
                    color={project.assessmentType === '普及普惠' ? '#722ed1' : '#13c2c2'}
                    style={{ marginLeft: 8 }}
                  >
                    {project.assessmentType}
                  </Tag>
                )}
              </p>
            </Col>
            <Col>
              <Row gutter={32}>
                <Col>
                  <Statistic
                    title="待审核"
                    value={stats?.submitted || 0}
                    valueStyle={{ color: '#fa8c16' }}
                    prefix={<ClockCircleOutlined />}
                  />
                </Col>
                <Col>
                  <Statistic
                    title="已通过"
                    value={stats?.approved || 0}
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
                <Col>
                  <Statistic
                    title="已驳回"
                    value={stats?.rejected || 0}
                    valueStyle={{ color: '#ff4d4f' }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        {/* Tab 内容区 */}
        <Card className={styles.contentCard}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
          />
        </Card>
      </Spin>

      {/* 驳回弹窗 */}
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
          驳回 <strong>{selectedSubmission?.submitterName}</strong> 的填报记录，请填写驳回原因：
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

export default ExpertDistrictDetail;
