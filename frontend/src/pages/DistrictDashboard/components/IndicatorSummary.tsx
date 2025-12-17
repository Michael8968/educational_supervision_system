import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Progress, Select, Spin, Empty, Tag } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import * as statisticsService from '../../../services/statisticsService';

interface IndicatorSummaryProps {
  districtId: string;
  projectId: string;
}

interface CVAnalysis {
  district: { id: string; name: string };
  schoolType: string;
  schoolCount: number;
  cvIndicators: Record<string, { cv: number; mean: number; stdDev: number; count: number } | null>;
  cvComposite: number | null;
  threshold: number;
  isCompliant: boolean | null;
}

interface ComplianceStats {
  total: number;
  compliant: number;
  nonCompliant: number;
  pending: number;
  complianceRate: number | null;
}

interface CategoryCompliance {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  total: number;
  compliant: number;
  complianceRate: number | null;
}

const IndicatorSummary: React.FC<IndicatorSummaryProps> = ({ districtId, projectId }) => {
  const [loading, setLoading] = useState(false);
  const [schoolType, setSchoolType] = useState<string>('小学');
  const [cvAnalysis, setCvAnalysis] = useState<CVAnalysis | null>(null);
  const [complianceStats, setComplianceStats] = useState<ComplianceStats | null>(null);
  const [categoryCompliance, setCategoryCompliance] = useState<CategoryCompliance[]>([]);

  // 加载数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [cvData, complianceData, categoryData] = await Promise.all([
          statisticsService.getCVAnalysis(projectId, districtId, schoolType),
          statisticsService.getComplianceSummary(projectId, { districtId }),
          statisticsService.getComplianceByCategory(projectId, districtId),
        ]);

        setCvAnalysis(cvData);
        setComplianceStats(complianceData);
        setCategoryCompliance(categoryData);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [districtId, projectId, schoolType]);

  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  // 差异系数指标名称映射
  const cvIndicatorNames: Record<string, string> = {
    studentTeacherRatio: '生师比',
    highEducationRatio: '高学历教师比例',
    buildingAreaPerStudent: '生均校舍面积',
    sportsAreaPerStudent: '生均体育场地面积',
    equipmentValuePerStudent: '生均教学设备值',
    computersPerHundred: '百名学生计算机数',
    booksPerStudent: '生均图书册数',
    avgClassSize: '平均班额',
  };

  return (
    <div>
      {/* 筛选条件 */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>学校类型：</span>
        <Select
          value={schoolType}
          onChange={setSchoolType}
          style={{ width: 120 }}
          options={[
            { value: '小学', label: '小学' },
            { value: '初中', label: '初中' },
          ]}
        />
      </div>

      {/* 概览统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="参评学校数"
              value={cvAnalysis?.schoolCount || 0}
              suffix="所"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="综合差异系数"
              value={cvAnalysis?.cvComposite !== null ? cvAnalysis?.cvComposite : '-'}
              precision={4}
              valueStyle={{
                color: cvAnalysis?.isCompliant ? '#3f8600' : cvAnalysis?.isCompliant === false ? '#cf1322' : undefined,
              }}
              prefix={
                cvAnalysis?.isCompliant ? (
                  <CheckCircleOutlined />
                ) : cvAnalysis?.isCompliant === false ? (
                  <CloseCircleOutlined />
                ) : null
              }
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              达标阈值: ≤{cvAnalysis?.threshold || (schoolType === '小学' ? 0.5 : 0.45)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="指标达标率"
              value={complianceStats?.complianceRate !== null ? complianceStats?.complianceRate : '-'}
              suffix="%"
              valueStyle={{
                color:
                  (complianceStats?.complianceRate || 0) >= 90
                    ? '#3f8600'
                    : (complianceStats?.complianceRate || 0) >= 70
                    ? '#faad14'
                    : '#cf1322',
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="达标/未达标/待评估"
              value={`${complianceStats?.compliant || 0} / ${complianceStats?.nonCompliant || 0} / ${complianceStats?.pending || 0}`}
              valueStyle={{ fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 差异系数指标详情 */}
      <Card title="差异系数指标" style={{ marginBottom: 24 }}>
        {cvAnalysis?.cvIndicators && Object.keys(cvAnalysis.cvIndicators).length > 0 ? (
          <Row gutter={[16, 16]}>
            {Object.entries(cvAnalysis.cvIndicators).map(([key, value]) => (
              <Col span={6} key={key}>
                <Card size="small" style={{ background: '#f9fafb' }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                    {cvIndicatorNames[key] || key}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>
                    {value?.cv !== null && value?.cv !== undefined ? value.cv.toFixed(4) : '-'}
                  </div>
                  {value && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                      均值: {value.mean?.toFixed(2) || '-'} | 样本: {value.count || 0}
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无差异系数数据" />
        )}
      </Card>

      {/* 各维度达标率 */}
      <Card title="各维度达标率">
        {categoryCompliance.length > 0 ? (
          <Row gutter={[24, 24]}>
            {categoryCompliance.map((category) => (
              <Col span={6} key={category.categoryId}>
                <div style={{ textAlign: 'center' }}>
                  <Progress
                    type="circle"
                    percent={category.complianceRate || 0}
                    strokeColor={
                      (category.complianceRate || 0) >= 90
                        ? '#52c41a'
                        : (category.complianceRate || 0) >= 70
                        ? '#faad14'
                        : '#ff4d4f'
                    }
                    format={(percent) => (
                      <span style={{ fontSize: 18, fontWeight: 600 }}>
                        {percent !== undefined ? `${percent.toFixed(1)}%` : '-'}
                      </span>
                    )}
                  />
                  <div style={{ marginTop: 12, fontSize: 14, color: '#374151' }}>
                    {category.categoryName}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {category.compliant}/{category.total} 项达标
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无维度达标数据" />
        )}
      </Card>
    </div>
  );
};

export default IndicatorSummary;
