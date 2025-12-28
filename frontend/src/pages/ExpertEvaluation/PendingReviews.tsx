/**
 * 待复评问题页面 - 专家复评整改结果
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
  Modal,
  Form,
  Input,
  Radio,
  message,
  Alert,
  Descriptions,
  Divider,
  Badge,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import * as evaluationService from '../../services/evaluationService';
import type {
  PendingReviewIssue,
  IssueSeverity,
} from '../../services/evaluationService';
import styles from './index.module.css';

const { TextArea } = Input;

const PendingReviews: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<PendingReviewIssue[]>([]);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<PendingReviewIssue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewForm] = Form.useForm();

  // 加载待复评问题
  const loadPendingReviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await evaluationService.getPendingReviews();
      setIssues(data || []);
    } catch (error) {
      console.error('加载待复评问题失败:', error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingReviews();
  }, [loadPendingReviews]);

  // 打开复评弹窗
  const handleOpenReview = (issue: PendingReviewIssue) => {
    setSelectedIssue(issue);
    reviewForm.resetFields();
    setReviewModalVisible(true);
  };

  // 提交复评
  const handleSubmitReview = async (values: { result: 'passed' | 'failed'; comment?: string }) => {
    if (!selectedIssue) return;

    setSubmitting(true);
    try {
      const res = await evaluationService.reviewIssueResult(selectedIssue.id, values);
      message.success(res.message);
      setReviewModalVisible(false);
      loadPendingReviews();
    } catch (error) {
      message.error('复评失败');
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
  const columns: ColumnsType<PendingReviewIssue> = [
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
      title: '评估对象',
      key: 'target',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{record.targetName}</span>
          <Tag color={record.targetType === 'school' ? 'blue' : 'green'} style={{ marginTop: 2 }}>
            {record.targetType === 'school' ? '学校' : '区县'}
          </Tag>
        </Space>
      ),
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
      title: '提交整改时间',
      dataIndex: 'rectifiedAt',
      key: 'rectifiedAt',
      width: 130,
      render: (date) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<SyncOutlined />}
          onClick={() => handleOpenReview(record)}
        >
          复评
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.expertEvaluation}>
      {/* 页面标题 */}
      <div className={styles.welcomeSection}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/expert/evaluations')}
          style={{ padding: 0, marginBottom: 8 }}
        >
          返回评估任务
        </Button>
        <h1 className={styles.welcomeTitle}>
          <SyncOutlined style={{ marginRight: 8 }} />
          待复评问题
        </h1>
        <p className={styles.welcomeSubtitle}>
          共有 <strong>{issues.length}</strong> 个问题等待复评
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className={styles.statsRow}>
        <Col span={8}>
          <Card className={styles.statCard}>
            <Statistic
              title="待复评"
              value={issues.length}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SyncOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles.statCard}>
            <Statistic
              title="高优先级"
              value={issues.filter(i => i.severity === 'high').length}
              valueStyle={{ color: '#ff4d4f' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className={styles.statCard}>
            <Statistic
              title="即将逾期"
              value={issues.filter(i => {
                if (!i.rectificationDeadline) return false;
                const deadline = new Date(i.rectificationDeadline);
                const now = new Date();
                const daysLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                return daysLeft <= 3 && daysLeft > 0;
              }).length}
              valueStyle={{ color: '#fa8c16' }}
              suffix="个"
            />
          </Card>
        </Col>
      </Row>

      {/* 问题列表 */}
      <Card>
        <div className={styles.filterBar}>
          <span style={{ fontWeight: 500 }}>待复评问题列表</span>
          <Button icon={<ReloadOutlined />} onClick={loadPendingReviews} loading={loading}>
            刷新
          </Button>
        </div>

        <Spin spinning={loading}>
          {issues.length > 0 ? (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={issues}
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
                  暂无待复评问题
                  <br />
                  所有整改已处理完毕
                </span>
              }
            />
          )}
        </Spin>
      </Card>

      {/* 复评弹窗 */}
      <Modal
        title="复评整改"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedIssue && (
          <div>
            {/* 问题信息 */}
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="问题编号">{selectedIssue.issueCode}</Descriptions.Item>
              <Descriptions.Item label="严重程度">
                <Tag color={evaluationService.issueSeverityConfig[selectedIssue.severity].color}>
                  {evaluationService.issueSeverityConfig[selectedIssue.severity].text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="评估对象">{selectedIssue.targetName}</Descriptions.Item>
              <Descriptions.Item label="整改期限">{formatDate(selectedIssue.rectificationDeadline)}</Descriptions.Item>
              <Descriptions.Item label="问题标题" span={2}>{selectedIssue.title}</Descriptions.Item>
              <Descriptions.Item label="问题描述" span={2}>
                {selectedIssue.description || '无'}
              </Descriptions.Item>
            </Descriptions>

            {/* 整改材料 */}
            <Divider>整改材料</Divider>
            {selectedIssue.rectificationEvidence ? (
              <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 24 }}>
                <p><strong>整改说明：</strong></p>
                <p>{selectedIssue.rectificationEvidence.description || '无说明'}</p>
                <p style={{ color: '#999', marginTop: 8 }}>
                  提交时间：{formatDate(selectedIssue.rectificationEvidence.submittedAt)}
                </p>
                {selectedIssue.rectificationEvidence.files && selectedIssue.rectificationEvidence.files.length > 0 && (
                  <>
                    <p><strong>附件：</strong></p>
                    <ul>
                      {selectedIssue.rectificationEvidence.files.map((file, idx) => (
                        <li key={idx}>
                          <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                            {file.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <Alert message="未提交整改材料" type="warning" style={{ marginBottom: 24 }} />
            )}

            {/* 复评表单 */}
            <Divider>复评意见</Divider>
            <Form form={reviewForm} onFinish={handleSubmitReview} layout="vertical">
              <Form.Item
                name="result"
                label="复评结果"
                rules={[{ required: true, message: '请选择复评结果' }]}
              >
                <Radio.Group>
                  <Radio.Button value="passed" style={{ marginRight: 16 }}>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} /> 整改通过
                  </Radio.Button>
                  <Radio.Button value="failed">
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 整改不通过
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                name="comment"
                label="复评意见"
              >
                <TextArea
                  rows={3}
                  placeholder="请填写复评意见（选填）..."
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setReviewModalVisible(false)}>取消</Button>
                  <Button type="primary" htmlType="submit" loading={submitting}>
                    提交复评
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

export default PendingReviews;
