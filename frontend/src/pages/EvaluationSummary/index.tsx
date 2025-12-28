/**
 * 评估汇总页面 - 多专家协同评估汇总视图
 * 项目管理员查看各评估对象的多专家评估结果
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
  Statistic,
  Row,
  Col,
  Progress,
  Tabs,
  Descriptions,
  Avatar,
  Tooltip,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import * as evaluationService from '../../services/evaluationService';
import type {
  ProjectEvaluationSummary,
  TargetEvaluationSummary,
  ExpertEvaluationInfo,
  ProjectExpertsWorkload,
  ExpertWorkloadItem,
  TargetDetailedEvaluations,
} from '../../services/evaluationService';
import styles from './index.module.css';

const EvaluationSummaryPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ProjectEvaluationSummary | null>(null);
  const [workload, setWorkload] = useState<ProjectExpertsWorkload | null>(null);
  const [activeTab, setActiveTab] = useState<'targets' | 'experts'>('targets');

  // 详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [targetDetail, setTargetDetail] = useState<TargetDetailedEvaluations | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const [summaryData, workloadData] = await Promise.all([
        evaluationService.getProjectEvaluationSummary(projectId),
        evaluationService.getProjectExpertsWorkload(projectId),
      ]);
      setSummary(summaryData);
      setWorkload(workloadData);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 查看目标详情
  const handleViewDetail = async (target: TargetEvaluationSummary) => {
    if (!projectId) return;

    setDetailModalVisible(true);
    setDetailLoading(true);
    try {
      const data = await evaluationService.getTargetDetailedEvaluations(projectId, target.targetId);
      setTargetDetail(data);
    } catch (error) {
      console.error('加载详情失败:', error);
      message.error('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  // 获取等级颜色
  const getLevelColor = (level?: string) => {
    switch (level) {
      case 'A': return 'success';
      case 'B': return 'processing';
      case 'C': return 'warning';
      case 'D': return 'error';
      default: return 'default';
    }
  };

  // 获取状态配置
  const getStatusConfig = (status: string) => {
    const config = evaluationService.evaluationStatusConfig[status as keyof typeof evaluationService.evaluationStatusConfig];
    return config || { text: status, color: 'default' };
  };

  // 目标列表表格列
  const targetColumns: ColumnsType<TargetEvaluationSummary> = [
    {
      title: '评估对象',
      key: 'target',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{record.targetName}</span>
          <Space size={4}>
            <Tag color={record.targetType === 'school' ? 'blue' : 'green'}>
              {record.targetType === 'school' ? '学校' : '区县'}
            </Tag>
            {record.districtName && <span style={{ color: '#999', fontSize: 12 }}>{record.districtName}</span>}
          </Space>
        </Space>
      ),
    },
    {
      title: '专家评估',
      key: 'experts',
      width: 180,
      render: (_, record) => (
        <Space>
          <Avatar.Group maxCount={3} size="small">
            {record.evaluations.map((e) => (
              <Tooltip key={e.evaluationId} title={`${e.expertName}: ${getStatusConfig(e.status).text}`}>
                <Avatar
                  size="small"
                  style={{ backgroundColor: e.status === 'submitted' ? '#52c41a' : '#1890ff' }}
                >
                  {e.expertName?.charAt(0)}
                </Avatar>
              </Tooltip>
            ))}
          </Avatar.Group>
          <span style={{ color: '#666' }}>
            {record.completedCount}/{record.expertCount}
          </span>
        </Space>
      ),
    },
    {
      title: '平均得分',
      dataIndex: 'averageScore',
      key: 'averageScore',
      width: 100,
      align: 'center',
      render: (score) => score ? (
        <span style={{ fontWeight: 600, fontSize: 16 }}>{score.toFixed(1)}</span>
      ) : '-',
    },
    {
      title: '评估等级',
      dataIndex: 'finalLevel',
      key: 'finalLevel',
      width: 100,
      align: 'center',
      render: (level) => level ? (
        <Tag color={getLevelColor(level)}>{level}</Tag>
      ) : '-',
    },
    {
      title: '合规率',
      dataIndex: 'complianceRate',
      key: 'complianceRate',
      width: 120,
      render: (rate) => rate !== undefined ? (
        <Progress
          percent={rate}
          size="small"
          status={rate >= 80 ? 'success' : rate >= 60 ? 'normal' : 'exception'}
        />
      ) : '-',
    },
    {
      title: '问题数',
      dataIndex: 'issueCount',
      key: 'issueCount',
      width: 80,
      align: 'center',
      render: (count) => (
        <Tag color={count > 0 ? 'warning' : 'default'}>{count}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  // 专家工作量表格列
  const expertColumns: ColumnsType<ExpertWorkloadItem> = [
    {
      title: '专家',
      key: 'expert',
      width: 150,
      render: (_, record) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <span style={{ fontWeight: 500 }}>{record.expertName}</span>
        </Space>
      ),
    },
    {
      title: '任务总数',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      align: 'center',
    },
    {
      title: '待开始',
      dataIndex: 'pending',
      key: 'pending',
      width: 80,
      align: 'center',
      render: (count) => <Tag color="default">{count}</Tag>,
    },
    {
      title: '进行中',
      dataIndex: 'inProgress',
      key: 'inProgress',
      width: 80,
      align: 'center',
      render: (count) => <Tag color="processing">{count}</Tag>,
    },
    {
      title: '已完成',
      dataIndex: 'completed',
      key: 'completed',
      width: 80,
      align: 'center',
      render: (count) => <Tag color="warning">{count}</Tag>,
    },
    {
      title: '已提交',
      dataIndex: 'submitted',
      key: 'submitted',
      width: 80,
      align: 'center',
      render: (count) => <Tag color="success">{count}</Tag>,
    },
    {
      title: '完成率',
      dataIndex: 'completionRate',
      key: 'completionRate',
      width: 150,
      render: (rate) => (
        <Progress
          percent={rate}
          size="small"
          status={rate >= 100 ? 'success' : 'active'}
        />
      ),
    },
    {
      title: '平均分',
      dataIndex: 'averageScore',
      key: 'averageScore',
      width: 80,
      align: 'center',
      render: (score) => score ? score.toFixed(1) : '-',
    },
  ];

  // 渲染统计卡片
  const renderStats = () => {
    if (!summary) return null;

    const { summaryStats } = summary;
    const completionRate = summaryStats.totalEvaluations > 0
      ? Math.round((summaryStats.completedEvaluations / summaryStats.totalEvaluations) * 100)
      : 0;

    return (
      <Row gutter={16} className={styles.statsRow}>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="评估对象"
              value={summaryStats.totalTargets}
              prefix={<TeamOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="已完成"
              value={summaryStats.completedTargets}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="评估任务"
              value={summaryStats.totalEvaluations}
              prefix={<ClockCircleOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="完成率"
              value={completionRate}
              valueStyle={{ color: completionRate >= 80 ? '#52c41a' : '#faad14' }}
              prefix={<BarChartOutlined />}
              suffix="%"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="平均分"
              value={summaryStats.averageScore || '-'}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="问题总数"
              value={summaryStats.totalIssues}
              valueStyle={{ color: summaryStats.totalIssues > 0 ? '#ff4d4f' : '#52c41a' }}
              prefix={<ExclamationCircleOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
      </Row>
    );
  };

  // 渲染详情弹窗
  const renderDetailModal = () => {
    if (!targetDetail) return null;

    return (
      <Modal
        title={`评估详情 - ${targetDetail.targetName}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={900}
      >
        <Spin spinning={detailLoading}>
          {/* 汇总信息 */}
          <Descriptions bordered column={4} size="small" style={{ marginBottom: 24 }}>
            <Descriptions.Item label="评估对象">{targetDetail.targetName}</Descriptions.Item>
            <Descriptions.Item label="对象类型">
              <Tag color={targetDetail.targetType === 'school' ? 'blue' : 'green'}>
                {targetDetail.targetType === 'school' ? '学校' : '区县'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="专家数量">{targetDetail.summary.expertCount}</Descriptions.Item>
            <Descriptions.Item label="已完成">{targetDetail.summary.completedCount}</Descriptions.Item>
            <Descriptions.Item label="平均得分" span={2}>
              {targetDetail.summary.averageScore ? (
                <span style={{ fontWeight: 600, fontSize: 18 }}>
                  {targetDetail.summary.averageScore.toFixed(1)}
                </span>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="分数范围" span={2}>
              {targetDetail.summary.scoreRange ? (
                <span>
                  {targetDetail.summary.scoreRange.min.toFixed(1)} - {targetDetail.summary.scoreRange.max.toFixed(1)}
                </span>
              ) : '-'}
            </Descriptions.Item>
          </Descriptions>

          {/* 各专家评估结果 */}
          <h4 style={{ marginBottom: 16 }}>专家评估结果</h4>
          <Table
            rowKey="id"
            dataSource={targetDetail.evaluations}
            pagination={false}
            size="small"
            columns={[
              {
                title: '专家',
                dataIndex: 'expertName',
                key: 'expertName',
                width: 120,
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                width: 100,
                render: (status) => {
                  const config = getStatusConfig(status);
                  return <Tag color={config.color}>{config.text}</Tag>;
                },
              },
              {
                title: '得分',
                key: 'score',
                width: 80,
                align: 'center',
                render: (_, record) => record.result?.overallScore?.toFixed(1) || '-',
              },
              {
                title: '等级',
                key: 'level',
                width: 80,
                align: 'center',
                render: (_, record) => record.result?.overallLevel ? (
                  <Tag color={getLevelColor(record.result.overallLevel)}>
                    {record.result.overallLevel}
                  </Tag>
                ) : '-',
              },
              {
                title: '合规率',
                key: 'complianceRate',
                width: 120,
                render: (_, record) => record.result?.complianceRate !== undefined ? (
                  <Progress
                    percent={record.result.complianceRate}
                    size="small"
                    status={record.result.complianceRate >= 80 ? 'success' : 'normal'}
                  />
                ) : '-',
              },
              {
                title: '提交时间',
                dataIndex: 'submittedAt',
                key: 'submittedAt',
                width: 120,
                render: (date) => formatDate(date),
              },
            ]}
          />

          {/* 主要意见汇总 */}
          {targetDetail.evaluations.some(e => e.result?.summary) && (
            <>
              <h4 style={{ marginTop: 24, marginBottom: 16 }}>评估意见汇总</h4>
              {targetDetail.evaluations
                .filter(e => e.result?.summary)
                .map(e => (
                  <Card key={e.id} size="small" style={{ marginBottom: 8 }} title={e.expertName}>
                    <p>{e.result?.summary}</p>
                    {e.result?.mainStrengths && e.result.mainStrengths.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <strong>主要优势：</strong>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                          {e.result.mainStrengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {e.result?.mainWeaknesses && e.result.mainWeaknesses.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <strong>主要不足：</strong>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                          {e.result.mainWeaknesses.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                  </Card>
                ))}
            </>
          )}
        </Spin>
      </Modal>
    );
  };

  return (
    <div className={styles.evaluationSummary}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ padding: 0, marginBottom: 8 }}
        >
          返回
        </Button>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.pageTitle}>
              <BarChartOutlined style={{ marginRight: 8 }} />
              评估汇总
            </h1>
            <p className={styles.pageSubtitle}>
              {summary?.projectName || '加载中...'}
            </p>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </div>
      </div>

      <Spin spinning={loading}>
        {/* 统计卡片 */}
        {renderStats()}

        {/* 内容区域 */}
        <Card>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'targets' | 'experts')}
            items={[
              {
                key: 'targets',
                label: (
                  <span>
                    <TeamOutlined /> 评估对象
                  </span>
                ),
                children: summary ? (
                  <Table
                    rowKey="targetId"
                    columns={targetColumns}
                    dataSource={summary.targets}
                    pagination={{
                      pageSize: 10,
                      showTotal: (total) => `共 ${total} 条记录`,
                      showSizeChanger: true,
                    }}
                  />
                ) : (
                  <Empty description="暂无数据" />
                ),
              },
              {
                key: 'experts',
                label: (
                  <span>
                    <UserOutlined /> 专家工作量
                  </span>
                ),
                children: workload ? (
                  <Table
                    rowKey="expertId"
                    columns={expertColumns}
                    dataSource={workload.experts}
                    pagination={false}
                  />
                ) : (
                  <Empty description="暂无数据" />
                ),
              },
            ]}
          />
        </Card>
      </Spin>

      {/* 详情弹窗 */}
      {renderDetailModal()}
    </div>
  );
};

export default EvaluationSummaryPage;
