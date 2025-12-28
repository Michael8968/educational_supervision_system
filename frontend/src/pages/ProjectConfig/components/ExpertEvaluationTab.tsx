/**
 * 专家评估管理 Tab 组件
 * 功能：评估任务分配、进度监控、结果汇总
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
  Modal,
  Form,
  Tooltip,
  Avatar,
  Tabs,
  DatePicker,
  Checkbox,
  Alert,
} from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  SendOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import * as evaluationService from '../../../services/evaluationService';
import type { Personnel } from '../types';
import styles from '../index.module.css';

interface ExpertEvaluationTabProps {
  projectId: string;
  projectStatus: string;
  personnel?: Record<string, Personnel[]>;
  disabled?: boolean;
}

interface EvaluationTarget {
  id: string;
  name: string;
  type: 'school' | 'district';
  districtName?: string;
  assignedExperts: Array<{
    expertId: string;
    expertName: string;
    evaluationId: string;
    status: string;
  }>;
  evaluationCount: number;
  completedCount: number;
}

interface ExpertInfo {
  id: string;
  name: string;
  phone?: string;
  assignedCount: number;
  completedCount: number;
  inProgressCount: number;
}

interface EvaluationStats {
  totalTargets: number;
  assignedTargets: number;
  totalEvaluations: number;
  completedEvaluations: number;
  submittedEvaluations: number;
  totalIssues: number;
}

const ExpertEvaluationTab: React.FC<ExpertEvaluationTabProps> = ({
  projectId,
  projectStatus,
  personnel,
  disabled = false,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'targets' | 'experts'>('targets');

  // 数据状态
  const [targets, setTargets] = useState<EvaluationTarget[]>([]);
  const [experts, setExperts] = useState<ExpertInfo[]>([]);
  const [stats, setStats] = useState<EvaluationStats | null>(null);

  // 分配弹窗
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [assignForm] = Form.useForm();
  const [assigning, setAssigning] = useState(false);

  // 加载评估对象列表
  const loadTargets = useCallback(async () => {
    try {
      const response = await evaluationService.getProjectEvaluationSummary(projectId, { status: 'all' });

      // 转换为目标列表格式
      const targetList: EvaluationTarget[] = response.targets.map(t => ({
        id: t.targetId,
        name: t.targetName,
        type: t.targetType,
        districtName: t.districtName,
        assignedExperts: t.evaluations.map(e => ({
          expertId: e.expertId,
          expertName: e.expertName,
          evaluationId: e.evaluationId,
          status: e.status,
        })),
        evaluationCount: t.expertCount,
        completedCount: t.completedCount,
      }));

      setTargets(targetList);

      // 更新统计
      setStats({
        totalTargets: response.summaryStats.totalTargets,
        assignedTargets: response.targets.filter(t => t.expertCount > 0).length,
        totalEvaluations: response.summaryStats.totalEvaluations,
        completedEvaluations: response.summaryStats.completedEvaluations,
        submittedEvaluations: response.targets.reduce((sum, t) =>
          sum + t.evaluations.filter(e => e.status === 'submitted').length, 0
        ),
        totalIssues: response.summaryStats.totalIssues,
      });
    } catch (error) {
      console.error('加载评估对象失败:', error);
      // 如果API不存在，使用空数据
      setTargets([]);
      setStats(null);
    }
  }, [projectId]);

  // 加载专家工作量
  const loadExperts = useCallback(async () => {
    try {
      const response = await evaluationService.getProjectExpertsWorkload(projectId);

      const expertList: ExpertInfo[] = response.experts.map(e => ({
        id: e.expertId,
        name: e.expertName,
        assignedCount: e.total,
        completedCount: e.completed + e.submitted,
        inProgressCount: e.inProgress,
      }));

      setExperts(expertList);
    } catch (error) {
      console.error('加载专家工作量失败:', error);
      setExperts([]);
    }
  }, [projectId]);

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadTargets(), loadExperts()]);
    } finally {
      setLoading(false);
    }
  }, [loadTargets, loadExperts]);

  useEffect(() => {
    if (projectStatus !== '配置中') {
      loadData();
    }
  }, [loadData, projectStatus]);

  // 获取可用专家列表
  const availableExperts = personnel?.experts || [];

  // 打开分配弹窗
  const handleOpenAssign = (targetIds?: string[]) => {
    if (targetIds) {
      setSelectedTargets(targetIds);
    }
    assignForm.resetFields();
    setAssignModalVisible(true);
  };

  // 分配评估任务
  const handleAssign = async (values: { expertId: string; dueDate?: any }) => {
    if (selectedTargets.length === 0) {
      message.warning('请先选择评估对象');
      return;
    }

    setAssigning(true);
    try {
      const targetsData = selectedTargets.map(id => {
        const target = targets.find(t => t.id === id);
        return {
          id,
          type: target?.type || 'school' as const,
        };
      });

      await evaluationService.assignEvaluations(projectId, {
        expertId: values.expertId,
        targets: targetsData,
        dueDate: values.dueDate?.format('YYYY-MM-DD'),
      });

      message.success(`成功分配 ${selectedTargets.length} 个评估任务`);
      setAssignModalVisible(false);
      setSelectedTargets([]);
      loadData();
    } catch (error) {
      message.error('分配失败');
    } finally {
      setAssigning(false);
    }
  };

  // 跳转到评估汇总页面
  const handleViewSummary = () => {
    // 根据当前路由确定跳转路径
    const basePath = window.location.pathname.includes('kindergarten')
      ? '/home/kindergarten'
      : '/home/balanced';
    navigate(`${basePath}/project/${projectId}/evaluation-summary`);
  };

  // 评估对象表格列
  const targetColumns: ColumnsType<EvaluationTarget> = [
    {
      title: '评估对象',
      key: 'target',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{record.name}</span>
          <Space size={4}>
            <Tag color={record.type === 'school' ? 'blue' : 'green'}>
              {record.type === 'school' ? '学校' : '区县'}
            </Tag>
            {record.districtName && (
              <span style={{ color: '#999', fontSize: 12 }}>{record.districtName}</span>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: '已分配专家',
      key: 'experts',
      width: 250,
      render: (_, record) => {
        if (record.assignedExperts.length === 0) {
          return <Tag color="default">未分配</Tag>;
        }
        return (
          <Space wrap>
            {record.assignedExperts.map(e => {
              const statusColor = {
                pending: 'default',
                in_progress: 'processing',
                completed: 'warning',
                submitted: 'success',
              }[e.status] || 'default';
              return (
                <Tooltip key={e.evaluationId} title={`状态: ${
                  { pending: '待开始', in_progress: '进行中', completed: '已完成', submitted: '已提交' }[e.status] || e.status
                }`}>
                  <Tag color={statusColor}>
                    <UserOutlined /> {e.expertName}
                  </Tag>
                </Tooltip>
              );
            })}
          </Space>
        );
      },
    },
    {
      title: '评估进度',
      key: 'progress',
      width: 150,
      render: (_, record) => {
        if (record.evaluationCount === 0) {
          return <span style={{ color: '#999' }}>-</span>;
        }
        const percent = Math.round((record.completedCount / record.evaluationCount) * 100);
        return (
          <Space>
            <Progress
              percent={percent}
              size="small"
              style={{ width: 80 }}
              status={percent === 100 ? 'success' : 'active'}
            />
            <span style={{ fontSize: 12, color: '#666' }}>
              {record.completedCount}/{record.evaluationCount}
            </span>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          {!disabled && (
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => handleOpenAssign([record.id])}
            >
              分配专家
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 专家工作量表格列
  const expertColumns: ColumnsType<ExpertInfo> = [
    {
      title: '专家',
      key: 'expert',
      render: (_, record) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <span style={{ fontWeight: 500 }}>{record.name}</span>
        </Space>
      ),
    },
    {
      title: '已分配',
      dataIndex: 'assignedCount',
      key: 'assignedCount',
      width: 100,
      align: 'center',
      render: (count) => <Tag color="blue">{count}</Tag>,
    },
    {
      title: '进行中',
      dataIndex: 'inProgressCount',
      key: 'inProgressCount',
      width: 100,
      align: 'center',
      render: (count) => <Tag color="processing">{count}</Tag>,
    },
    {
      title: '已完成',
      dataIndex: 'completedCount',
      key: 'completedCount',
      width: 100,
      align: 'center',
      render: (count) => <Tag color="success">{count}</Tag>,
    },
    {
      title: '完成率',
      key: 'rate',
      width: 150,
      render: (_, record) => {
        const percent = record.assignedCount > 0
          ? Math.round((record.completedCount / record.assignedCount) * 100)
          : 0;
        return (
          <Progress
            percent={percent}
            size="small"
            status={percent === 100 ? 'success' : 'active'}
          />
        );
      },
    },
  ];

  // 项目未到评估阶段
  if (projectStatus === '配置中') {
    return (
      <div className={styles.expertReviewTab}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="项目尚在配置中，暂无评估数据"
        >
          <p style={{ color: '#999' }}>请先完成项目配置并启动后再进行专家评估分配</p>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.expertReviewTab}>
      {/* 统计卡片 */}
      <Card className={styles.statsCard} size="small" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={4}>
            <Statistic
              title="评估对象"
              value={stats?.totalTargets || 0}
              prefix={<TeamOutlined />}
              suffix="个"
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="已分配"
              value={stats?.assignedTargets || 0}
              valueStyle={{ color: '#1890ff' }}
              suffix="个"
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="评估任务"
              value={stats?.totalEvaluations || 0}
              prefix={<ClockCircleOutlined />}
              suffix="个"
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="已完成"
              value={stats?.completedEvaluations || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              suffix="个"
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="已提交"
              value={stats?.submittedEvaluations || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SendOutlined />}
              suffix="个"
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="发现问题"
              value={stats?.totalIssues || 0}
              valueStyle={{ color: stats?.totalIssues ? '#fa8c16' : undefined }}
              prefix={<ExclamationCircleOutlined />}
              suffix="个"
            />
          </Col>
        </Row>
      </Card>

      {/* 操作栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div className={styles.filterBar}>
          <Space>
            {!disabled && selectedTargets.length > 0 && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleOpenAssign()}
              >
                批量分配 ({selectedTargets.length})
              </Button>
            )}
          </Space>
          <Space>
            <Button
              icon={<BarChartOutlined />}
              onClick={handleViewSummary}
            >
              查看评估汇总
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>
      </Card>

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
              children: (
                <Spin spinning={loading}>
                  {targets.length > 0 ? (
                    <Table
                      rowKey="id"
                      columns={targetColumns}
                      dataSource={targets}
                      rowSelection={disabled ? undefined : {
                        selectedRowKeys: selectedTargets,
                        onChange: (keys) => setSelectedTargets(keys as string[]),
                      }}
                      pagination={{
                        pageSize: 10,
                        showTotal: (total) => `共 ${total} 个评估对象`,
                        showSizeChanger: true,
                      }}
                    />
                  ) : (
                    <Empty description="暂无评估对象数据">
                      <p style={{ color: '#999' }}>
                        请先在"评估对象"Tab中配置评估对象
                      </p>
                    </Empty>
                  )}
                </Spin>
              ),
            },
            {
              key: 'experts',
              label: (
                <span>
                  <UserOutlined /> 专家工作量
                </span>
              ),
              children: (
                <Spin spinning={loading}>
                  {experts.length > 0 ? (
                    <Table
                      rowKey="id"
                      columns={expertColumns}
                      dataSource={experts}
                      pagination={false}
                    />
                  ) : (
                    <Empty description="暂无专家评估数据">
                      <p style={{ color: '#999' }}>
                        请先分配评估任务给专家
                      </p>
                    </Empty>
                  )}
                </Spin>
              ),
            },
          ]}
        />
      </Card>

      {/* 分配弹窗 */}
      <Modal
        title="分配评估任务"
        open={assignModalVisible}
        onCancel={() => {
          setAssignModalVisible(false);
          setSelectedTargets([]);
        }}
        footer={null}
        width={500}
      >
        <Alert
          message={`已选择 ${selectedTargets.length} 个评估对象`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form form={assignForm} onFinish={handleAssign} layout="vertical">
          <Form.Item
            name="expertId"
            label="选择专家"
            rules={[{ required: true, message: '请选择专家' }]}
          >
            <Select placeholder="选择要分配的专家">
              {availableExperts.map(expert => (
                <Select.Option key={expert.id} value={expert.id}>
                  <Space>
                    <UserOutlined />
                    <span>{expert.name}</span>
                    {expert.phone && <span style={{ color: '#999' }}>({expert.phone})</span>}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="dueDate"
            label="评估截止日期"
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="选择截止日期（可选）"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAssignModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={assigning}>
                确认分配
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpertEvaluationTab;
