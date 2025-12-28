/**
 * 专家评估工作台 - 评估任务列表页面
 * 显示专家分配的评估任务，支持开始评估
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Empty,
  Spin,
  Progress,
  Select,
  message,
  Tooltip,
} from 'antd';
import {
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  RightOutlined,
  ReloadOutlined,
  FileSearchOutlined,
  AimOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../../stores/authStore';
import * as evaluationService from '../../services/evaluationService';
import type { Evaluation, EvaluationStatus } from '../../services/evaluationService';
import styles from './index.module.css';

const ExpertEvaluation: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [statusFilter, setStatusFilter] = useState<EvaluationStatus | ''>('');

  // 加载评估任务列表
  const loadEvaluations = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: EvaluationStatus } = {};
      if (statusFilter) {
        params.status = statusFilter;
      }
      const data = await evaluationService.getMyEvaluations(params);
      setEvaluations(data || []);
    } catch (error) {
      console.error('加载评估任务失败:', error);
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations]);

  // 计算统计数据
  const stats = {
    total: evaluations.length,
    pending: evaluations.filter(e => e.status === 'pending').length,
    inProgress: evaluations.filter(e => e.status === 'in_progress').length,
    submitted: evaluations.filter(e => e.status === 'submitted').length,
  };

  // 开始评估任务
  const handleStart = async (evaluation: Evaluation) => {
    try {
      await evaluationService.startEvaluation(evaluation.id);
      message.success('评估任务已开始');
      loadEvaluations();
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 进入评估详情
  const handleEnter = (evaluation: Evaluation) => {
    navigate(`/expert/evaluations/${evaluation.id}`);
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  // 表格列定义
  const columns: ColumnsType<Evaluation> = [
    {
      title: '评估对象',
      key: 'target',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{record.targetName || '未知对象'}</span>
          <Tag color={record.targetType === 'school' ? 'blue' : 'green'} style={{ marginTop: 4 }}>
            {record.targetType === 'school' ? '学校' : '区县'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '所属项目',
      dataIndex: 'projectName',
      key: 'projectName',
      ellipsis: true,
    },
    {
      title: '评分进度',
      key: 'progress',
      width: 150,
      render: (_, record) => {
        const progress = record.progress;
        if (!progress) return '-';
        const percent = progress.total > 0
          ? Math.round((progress.scored / progress.total) * 100)
          : 0;
        return (
          <Tooltip title={`已评分 ${progress.scored}/${progress.total} 个指标`}>
            <Progress
              percent={percent}
              size="small"
              status={percent === 100 ? 'success' : 'active'}
            />
          </Tooltip>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const config = evaluationService.evaluationStatusConfig[record.status];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date) => {
        if (!date) return '-';
        const dueDate = new Date(date);
        const now = new Date();
        const isOverdue = dueDate < now;
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
      width: 150,
      render: (_, record) => {
        if (record.status === 'pending') {
          return (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record)}
            >
              开始评估
            </Button>
          );
        }
        if (record.status === 'in_progress' || record.status === 'completed') {
          return (
            <Button
              type="primary"
              icon={<RightOutlined />}
              onClick={() => handleEnter(record)}
            >
              继续评估
            </Button>
          );
        }
        return (
          <Button
            icon={<FileSearchOutlined />}
            onClick={() => handleEnter(record)}
          >
            查看详情
          </Button>
        );
      },
    },
  ];

  return (
    <div className={styles.expertEvaluation}>
      {/* 欢迎区域 */}
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>
          <AimOutlined style={{ marginRight: 8 }} />
          专业评估工作台
        </h1>
        <p className={styles.welcomeSubtitle}>
          欢迎，{user?.name || '专家'}！您共有 <strong>{stats.total}</strong> 个评估任务
          {stats.pending > 0 && <>，其中 <strong>{stats.pending}</strong> 个待开始</>}
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className={styles.statsRow}>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="全部任务"
              value={stats.total}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ProjectOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="待开始"
              value={stats.pending}
              valueStyle={{ color: '#8c8c8c' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="进行中"
              value={stats.inProgress}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="已提交"
              value={stats.submitted}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选和列表 */}
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
              <Select.Option value="pending">待开始</Select.Option>
              <Select.Option value="in_progress">进行中</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="submitted">已提交</Select.Option>
            </Select>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={loadEvaluations} loading={loading}>
            刷新
          </Button>
        </div>

        <Spin spinning={loading}>
          {evaluations.length > 0 ? (
            <Table
              rowKey="id"
              columns={columns}
              dataSource={evaluations}
              pagination={{
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条记录`,
                showSizeChanger: true,
              }}
            />
          ) : (
            <Empty
              image={<FileSearchOutlined style={{ fontSize: 64, color: '#ccc' }} />}
              description={
                <span style={{ color: '#999' }}>
                  暂无评估任务
                  <br />
                  请等待项目管理员分配评估对象
                </span>
              }
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default ExpertEvaluation;
