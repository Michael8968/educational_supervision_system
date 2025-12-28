/**
 * 问题整改页面 - 被评估对象（学校/区县）查看和提交整改
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Spin,
  Empty,
  Statistic,
  Row,
  Col,
  Modal,
  Form,
  Input,
  Upload,
  message,
  Alert,
  Timeline,
  Descriptions,
  Select,
  Badge,
} from 'antd';
import {
  ExclamationCircleOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  FileTextOutlined,
  ReloadOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as evaluationService from '../../services/evaluationService';
import type {
  Issue,
  IssueStatus,
  IssueSeverity,
  MyIssuesResponse,
} from '../../services/evaluationService';
import styles from './index.module.css';

const { TextArea } = Input;
const { Dragger } = Upload;

const IssueRectification: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MyIssuesResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | ''>('');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [rectifyModalVisible, setRectifyModalVisible] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rectifyForm] = Form.useForm();

  // 加载问题列表
  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: IssueStatus } = {};
      if (statusFilter) {
        params.status = statusFilter;
      }
      const result = await evaluationService.getMyIssues(params);
      setData(result);
    } catch (error) {
      console.error('加载问题列表失败:', error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  // 查看问题详情
  const handleViewDetail = (issue: Issue) => {
    setSelectedIssue(issue);
    setDetailModalVisible(true);
  };

  // 打开整改提交弹窗
  const handleOpenRectify = (issue: Issue) => {
    setSelectedIssue(issue);
    rectifyForm.resetFields();
    setRectifyModalVisible(true);
  };

  // 提交整改
  const handleSubmitRectify = async (values: { description: string }) => {
    if (!selectedIssue) return;

    setSubmitting(true);
    try {
      // 这里暂时使用空的证据文件列表，后续可以接入文件上传
      await evaluationService.submitMyRectification(selectedIssue.id, {
        evidence: [],
        description: values.description,
      });
      message.success('整改材料已提交，等待专家复评');
      setRectifyModalVisible(false);
      loadIssues();
    } catch (error) {
      message.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  // 表格列定义
  const columns: ColumnsType<Issue> = [
    {
      title: '问题编号',
      dataIndex: 'issueCode',
      key: 'issueCode',
      width: 120,
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: '问题标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '所属项目',
      dataIndex: 'projectName',
      key: 'projectName',
      width: 180,
      ellipsis: true,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: IssueSeverity) => {
        const config = evaluationService.issueSeverityConfig[severity];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: IssueStatus) => {
        const config = evaluationService.issueStatusConfig[status];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '整改期限',
      dataIndex: 'rectificationDeadline',
      key: 'rectificationDeadline',
      width: 120,
      render: (date) => {
        if (!date) return '-';
        const deadline = new Date(date);
        const now = new Date();
        const isOverdue = deadline < now;
        return (
          <span style={{ color: isOverdue ? '#ff4d4f' : undefined }}>
            {formatDate(date)}
            {isOverdue && <Tag color="error" style={{ marginLeft: 4 }}>已逾期</Tag>}
          </span>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => handleViewDetail(record)}
          >
            查看详情
          </Button>
          {(record.status === 'open' || record.status === 'rectifying') && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleOpenRectify(record)}
            >
              提交整改
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const stats = data?.stats || { total: 0, open: 0, rectifying: 0, resolved: 0, closed: 0 };

  return (
    <div className={styles.issueRectification}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <ExclamationCircleOutlined style={{ marginRight: 8 }} />
          问题整改
        </h1>
        {data?.target && (
          <p className={styles.pageSubtitle}>
            {data.target.type === 'school' ? '学校' : '区县'}：{data.target.name}
          </p>
        )}
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className={styles.statsRow}>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="全部问题"
              value={stats.total}
              valueStyle={{ color: '#1890ff' }}
              prefix={<FileTextOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title={<Badge status="error" text="待整改" />}
              value={stats.open}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title={<Badge status="processing" text="待复评" />}
              value={stats.rectifying}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SyncOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title={<Badge status="success" text="已解决" />}
              value={stats.resolved}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 问题列表 */}
      <Card>
        <div className={styles.filterBar}>
          <Space>
            <Select
              placeholder="状态筛选"
              style={{ width: 140 }}
              allowClear
              value={statusFilter || undefined}
              onChange={(val) => setStatusFilter(val || '')}
            >
              <Select.Option value="open">待整改</Select.Option>
              <Select.Option value="rectifying">待复评</Select.Option>
              <Select.Option value="resolved">已解决</Select.Option>
              <Select.Option value="closed">已关闭</Select.Option>
            </Select>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={loadIssues} loading={loading}>
            刷新
          </Button>
        </div>

        <Spin spinning={loading}>
          {data && data.issues.length > 0 ? (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={data.issues}
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条记录`,
                showSizeChanger: true,
              }}
            />
          ) : (
            <Empty
              image={<CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />}
              description={
                <span style={{ color: '#999' }}>
                  暂无待处理的问题
                  <br />
                  保持良好状态！
                </span>
              }
            />
          )}
        </Spin>
      </Card>

      {/* 问题详情弹窗 */}
      <Modal
        title="问题详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          (selectedIssue?.status === 'open' || selectedIssue?.status === 'rectifying') && (
            <Button
              key="rectify"
              type="primary"
              onClick={() => {
                setDetailModalVisible(false);
                handleOpenRectify(selectedIssue!);
              }}
            >
              提交整改
            </Button>
          ),
        ]}
        width={700}
      >
        {selectedIssue && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="问题编号">{selectedIssue.issueCode}</Descriptions.Item>
              <Descriptions.Item label="严重程度">
                <Tag color={evaluationService.issueSeverityConfig[selectedIssue.severity].color}>
                  {evaluationService.issueSeverityConfig[selectedIssue.severity].text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={evaluationService.issueStatusConfig[selectedIssue.status].color}>
                  {evaluationService.issueStatusConfig[selectedIssue.status].text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="整改期限">
                {formatDate(selectedIssue.rectificationDeadline)}
              </Descriptions.Item>
              <Descriptions.Item label="问题标题" span={2}>
                {selectedIssue.title}
              </Descriptions.Item>
              <Descriptions.Item label="问题描述" span={2}>
                {selectedIssue.description || '无'}
              </Descriptions.Item>
              {selectedIssue.rectificationSuggestion && (
                <Descriptions.Item label="整改建议" span={2}>
                  <Alert message={selectedIssue.rectificationSuggestion} type="info" />
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* 整改时间线 */}
            <div style={{ marginTop: 24 }}>
              <h4>处理进度</h4>
              <Timeline>
                <Timeline.Item color="red">
                  <p><strong>问题发现</strong></p>
                  <p style={{ color: '#666' }}>{formatDate(selectedIssue.foundAt || selectedIssue.createdAt)}</p>
                </Timeline.Item>
                {selectedIssue.rectifiedAt && (
                  <Timeline.Item color="blue">
                    <p><strong>提交整改</strong></p>
                    <p style={{ color: '#666' }}>{formatDate(selectedIssue.rectifiedAt)}</p>
                  </Timeline.Item>
                )}
                {selectedIssue.reviewResult && (
                  <Timeline.Item color={selectedIssue.reviewResult === 'passed' ? 'green' : 'orange'}>
                    <p><strong>专家复评</strong></p>
                    <p style={{ color: '#666' }}>
                      {selectedIssue.reviewResult === 'passed' ? '通过' : '未通过'}
                      {selectedIssue.reviewComment && ` - ${selectedIssue.reviewComment}`}
                    </p>
                  </Timeline.Item>
                )}
                {selectedIssue.status === 'resolved' && (
                  <Timeline.Item color="green">
                    <p><strong>问题解决</strong></p>
                  </Timeline.Item>
                )}
              </Timeline>
            </div>
          </div>
        )}
      </Modal>

      {/* 提交整改弹窗 */}
      <Modal
        title="提交整改"
        open={rectifyModalVisible}
        onCancel={() => setRectifyModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedIssue && (
          <div>
            <Alert
              message={`正在整改问题：${selectedIssue.title}`}
              description={selectedIssue.rectificationSuggestion || '请按要求提交整改材料'}
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Form form={rectifyForm} onFinish={handleSubmitRectify} layout="vertical">
              <Form.Item
                name="description"
                label="整改说明"
                rules={[{ required: true, message: '请填写整改说明' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="请详细描述已采取的整改措施..."
                />
              </Form.Item>

              <Form.Item label="上传整改材料">
                <Dragger
                  name="file"
                  multiple
                  action="/api/upload" // 需要实际的上传接口
                  disabled // 暂时禁用，后续接入文件上传
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
                  <p className="ant-upload-hint">支持 PDF、Word、图片等格式（功能开发中）</p>
                </Dragger>
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setRectifyModalVisible(false)}>取消</Button>
                  <Button type="primary" htmlType="submit" loading={submitting}>
                    提交整改
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default IssueRectification;
