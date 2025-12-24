/**
 * 评审概览Tab
 * 显示统计卡片和区县审核进度表格
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Progress,
  Spin,
} from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as expertService from '../../../services/expertService';
import type { DistrictInfo } from '../../../services/expertService';

interface ReviewOverviewProps {
  projectId: string;
}

const ReviewOverview: React.FC<ReviewOverviewProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [districts, setDistricts] = useState<DistrictInfo[]>([]);
  const [summary, setSummary] = useState<{
    totalSchools: number;
    totalRecords: number;
    totalSubmitted: number;
    totalApproved: number;
    totalRejected: number;
    totalCompleted: number;
    overallCompletionRate: number;
  } | null>(null);

  // 加载区县统计
  const loadDistrictStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await expertService.getProjectDistrictStats(projectId);
      setDistricts(response.districts || []);
      setSummary(response.summary || null);
    } catch (error) {
      console.error('加载区县统计失败:', error);
      setDistricts([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDistrictStats();
  }, [loadDistrictStats]);

  // 表格列定义
  const columns: ColumnsType<DistrictInfo> = [
    {
      title: '区县',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 120,
    },
    {
      title: '学校数',
      dataIndex: 'schoolCount',
      key: 'schoolCount',
      width: 80,
      align: 'center',
    },
    {
      title: '总记录',
      key: 'total',
      width: 80,
      align: 'center',
      render: (_, record) => record.stats.total,
    },
    {
      title: '待审核',
      key: 'submitted',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <span style={{ color: record.stats.submitted > 0 ? '#fa8c16' : '#999' }}>
          {record.stats.submitted}
        </span>
      ),
    },
    {
      title: '已通过',
      key: 'approved',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <span style={{ color: record.stats.approved > 0 ? '#52c41a' : '#999' }}>
          {record.stats.approved}
        </span>
      ),
    },
    {
      title: '已驳回',
      key: 'rejected',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <span style={{ color: record.stats.rejected > 0 ? '#ff4d4f' : '#999' }}>
          {record.stats.rejected}
        </span>
      ),
    },
    {
      title: '审核进度',
      key: 'progress',
      width: 180,
      render: (_, record) => (
        <Progress
          percent={record.stats.completionRate}
          size="small"
          strokeColor={record.stats.completionRate === 100 ? '#52c41a' : '#1890ff'}
        />
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总记录数"
              value={summary?.totalRecords || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待审核"
              value={summary?.totalSubmitted || 0}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已通过"
              value={summary?.totalApproved || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已驳回"
              value={summary?.totalRejected || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 区县进度表格 */}
      <Card title="区县审核进度">
        <Table
          rowKey="districtId"
          columns={columns}
          dataSource={districts}
          pagination={false}
          size="middle"
          scroll={{ x: 800 }}
        />
      </Card>
    </Spin>
  );
};

export default ReviewOverview;
