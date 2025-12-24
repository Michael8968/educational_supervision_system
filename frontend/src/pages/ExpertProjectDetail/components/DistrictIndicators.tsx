/**
 * 区县指标Tab
 * 显示各区县的填报进度和指标完成情况，支持进入区县详情
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Progress,
  Spin,
  Empty,
  Button,
  Tag,
} from 'antd';
import {
  EnvironmentOutlined,
  BankOutlined,
  RightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import * as expertService from '../../../services/expertService';
import type { DistrictInfo } from '../../../services/expertService';

interface DistrictIndicatorsProps {
  projectId: string;
  assessmentType?: '普及普惠' | '优质均衡';
}

const DistrictIndicators: React.FC<DistrictIndicatorsProps> = ({
  projectId,
  assessmentType,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [districts, setDistricts] = useState<DistrictInfo[]>([]);

  // 加载区县数据
  const loadDistricts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await expertService.getProjectDistrictStats(projectId);
      setDistricts(response.districts || []);
    } catch (error) {
      console.error('加载区县数据失败:', error);
      setDistricts([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDistricts();
  }, [loadDistricts]);

  // 进入区县详情
  const handleEnterDistrict = (district: DistrictInfo) => {
    navigate(`/expert/projects/${projectId}/districts/${district.districtId}`);
  };

  // 获取进度状态
  const getProgressStatus = (rate: number) => {
    if (rate >= 100) return { color: '#52c41a', text: '已完成' };
    if (rate >= 80) return { color: '#1890ff', text: '进行中' };
    if (rate >= 50) return { color: '#faad14', text: '进行中' };
    return { color: '#ff4d4f', text: '待处理' };
  };

  return (
    <Spin spinning={loading}>
      {districts.length > 0 ? (
        <Row gutter={[16, 16]}>
          {districts.map((district) => {
            const { stats } = district;
            const progressStatus = getProgressStatus(stats.completionRate);

            return (
              <Col xs={24} sm={12} lg={8} key={district.districtId}>
                <Card
                  hoverable
                  onClick={() => handleEnterDistrict(district)}
                  style={{ height: '100%' }}
                >
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>
                        <EnvironmentOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                        {district.districtName}
                      </span>
                      <Tag color={progressStatus.color}>{progressStatus.text}</Tag>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#666', fontSize: 13 }}>
                      <span>
                        <BankOutlined style={{ marginRight: 4 }} />
                        {district.schoolCount} 所学校
                      </span>
                    </div>
                  </div>

                  {/* 审核进度 */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: '#999' }}>审核进度</span>
                      <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>
                        {stats.completionRate}%
                      </span>
                    </div>
                    <Progress
                      percent={stats.completionRate}
                      showInfo={false}
                      strokeColor={progressStatus.color}
                    />
                  </div>

                  {/* 统计数据 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    padding: '12px 0',
                    borderTop: '1px solid #f0f0f0',
                    borderBottom: '1px solid #f0f0f0',
                    marginBottom: 16,
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#fa8c16' }}>
                        {stats.submitted}
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        待审核
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#52c41a' }}>
                        {stats.approved}
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        <CheckCircleOutlined style={{ marginRight: 4 }} />
                        已通过
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 600, color: '#333' }}>
                        {stats.total}
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>总记录</div>
                    </div>
                  </div>

                  {/* 查看详情按钮 */}
                  <Button
                    type="primary"
                    block
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEnterDistrict(district);
                    }}
                  >
                    查看区县指标
                    <RightOutlined />
                  </Button>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无区县数据"
          />
        </Card>
      )}
    </Spin>
  );
};

export default DistrictIndicators;
