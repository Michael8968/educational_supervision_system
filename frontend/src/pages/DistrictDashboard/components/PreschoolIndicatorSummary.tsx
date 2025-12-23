/**
 * 普及普惠指标汇总组件
 *
 * 显示学前教育普及普惠督导评估的指标汇总：
 * - 普及普惠水平指标（3项）
 * - 综合达标情况与等级判定
 * - 学前双普等级判定标准
 */
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Spin, Empty, Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  getUniversalizationSummary,
  getOverallCompliance,
  UniversalizationSummary,
  OverallComplianceResponse,
  IndicatorData,
  getComplianceLevelText,
  getComplianceLevelColor,
  getPreschoolLevelText,
} from '../../../services/preschoolStatisticsService';

interface PreschoolIndicatorSummaryProps {
  districtId: string;
  projectId: string;
  refreshKey?: number;
}

const PreschoolIndicatorSummary: React.FC<PreschoolIndicatorSummaryProps> = ({
  districtId,
  projectId,
  refreshKey,
}) => {
  const [universalizationData, setUniversalizationData] = useState<UniversalizationSummary | null>(null);
  const [universalizationLoading, setUniversalizationLoading] = useState(false);
  const [overallComplianceData, setOverallComplianceData] = useState<OverallComplianceResponse | null>(null);
  const [overallComplianceLoading, setOverallComplianceLoading] = useState(false);

  // 加载普及普惠水平指标数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadUniversalizationData = async () => {
      setUniversalizationLoading(true);
      try {
        const result = await getUniversalizationSummary(districtId, projectId);
        setUniversalizationData(result);
      } catch (error) {
        console.error('加载普及普惠水平指标数据失败:', error);
      } finally {
        setUniversalizationLoading(false);
      }
    };

    loadUniversalizationData();
  }, [districtId, projectId, refreshKey]);

  // 加载综合达标情况数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadOverallComplianceData = async () => {
      setOverallComplianceLoading(true);
      try {
        const result = await getOverallCompliance(districtId, projectId);
        setOverallComplianceData(result);
      } catch (error) {
        console.error('加载综合达标情况数据失败:', error);
      } finally {
        setOverallComplianceLoading(false);
      }
    };

    loadOverallComplianceData();
  }, [districtId, projectId, refreshKey]);

  // 渲染普及普惠水平指标卡片
  const renderUniversalizationIndicatorCard = (indicator: IndicatorData) => {
    const bgColor = indicator.isPending
      ? '#f5f5f5'
      : indicator.isCompliant
      ? '#f6ffed'
      : indicator.isBasic
      ? '#fffbe6'
      : '#fff2f0';
    const borderColor = indicator.isPending
      ? '#d9d9d9'
      : indicator.isCompliant
      ? '#b7eb8f'
      : indicator.isBasic
      ? '#ffe58f'
      : '#ffccc7';
    const valueColor = indicator.isPending
      ? '#999'
      : indicator.isCompliant
      ? '#52c41a'
      : indicator.isBasic
      ? '#faad14'
      : '#ff4d4f';

    return (
      <Card
        size="small"
        style={{ background: bgColor, borderColor, height: '100%' }}
      >
        <div style={{ marginBottom: 8 }}>
          <Tooltip title={indicator.name}>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
              {indicator.code}. {indicator.name}
            </span>
          </Tooltip>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: valueColor }}>
            {indicator.value !== null ? `${indicator.value}${indicator.unit}` : '-'}
          </span>
          <Tag color={getComplianceLevelColor(indicator.complianceLevel)}>
            {getComplianceLevelText(indicator.complianceLevel)}
          </Tag>
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          标准: {indicator.operator}{indicator.threshold}{indicator.unit}
        </div>
      </Card>
    );
  };

  // 渲染综合达标等级判定卡片
  const renderComplianceLevelCard = () => {
    if (!overallComplianceData) return null;

    const { complianceLevel, summary } = overallComplianceData;
    const level = complianceLevel?.level || 'non-compliant';
    const bgColor = level === 'excellence'
      ? '#f6ffed'
      : level === 'improved'
      ? '#e6f7ff'
      : level === 'consolidated'
      ? '#f0f5ff'
      : '#fff2f0';
    const borderColor = level === 'excellence'
      ? '#b7eb8f'
      : level === 'improved'
      ? '#91d5ff'
      : level === 'consolidated'
      ? '#adc6ff'
      : '#ffccc7';
    const textColor = level === 'excellence'
      ? '#52c41a'
      : level === 'improved'
      ? '#1890ff'
      : level === 'consolidated'
      ? '#597ef7'
      : '#ff4d4f';

    return (
      <Card
        size="small"
        style={{
          background: bgColor,
          borderColor,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>综合达标等级</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: textColor, marginBottom: 8 }}>
            {complianceLevel ? getPreschoolLevelText(complianceLevel.level) : '待评估'}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            合格: {summary.compliantCount} | 基本合格: {summary.basicCount} | 不合格: {summary.nonCompliantCount}
          </div>
          {summary.pendingCount > 0 && (
            <div style={{ fontSize: 11, color: '#faad14' }}>
              {summary.pendingCount} 项待填报
            </div>
          )}
        </div>
      </Card>
    );
  };

  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  const isLoading = universalizationLoading || overallComplianceLoading;

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* 普及普惠水平指标（3项） */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>普及普惠水平指标（3项）</span>
            {universalizationData?.summary && (
              <span style={{ fontSize: 14, fontWeight: 'normal' }}>
                {universalizationData.summary.allCompliant ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    {universalizationData.summary.compliantCount}/{universalizationData.summary.totalCount} 项达标
                  </Tag>
                ) : universalizationData.summary.pendingCount > 0 ? (
                  <Tag icon={<ExclamationCircleOutlined />} color="warning">
                    {universalizationData.summary.compliantCount}/{universalizationData.summary.totalCount} 项达标，{universalizationData.summary.pendingCount} 项待填报
                  </Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="error">
                    {universalizationData.summary.compliantCount}/{universalizationData.summary.totalCount} 项达标
                  </Tag>
                )}
              </span>
            )}
          </div>
        }
        style={{ marginBottom: 24 }}
      >
        {universalizationData?.indicators && universalizationData.indicators.length > 0 ? (
          <Row gutter={[16, 16]}>
            {universalizationData.indicators.map((indicator) => (
              <Col xs={24} sm={12} md={8} key={indicator.code}>
                {renderUniversalizationIndicatorCard(indicator)}
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无普及普惠水平指标数据" />
        )}
      </Card>

      {/* 综合达标情况 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>综合达标情况与等级判定</span>
            {overallComplianceData?.complianceLevel && (
              <Tag
                color={
                  overallComplianceData.complianceLevel.level === 'excellence'
                    ? 'success'
                    : overallComplianceData.complianceLevel.level === 'improved'
                    ? 'processing'
                    : overallComplianceData.complianceLevel.level === 'consolidated'
                    ? 'blue'
                    : 'error'
                }
                style={{ fontSize: 14, padding: '4px 12px' }}
              >
                {getPreschoolLevelText(overallComplianceData.complianceLevel.level)}
              </Tag>
            )}
          </div>
        }
        style={{ marginBottom: 24 }}
      >
        {overallComplianceData ? (
          <Row gutter={[16, 16]}>
            {/* 各指标评估结果 */}
            {overallComplianceData.indicators.map((indicator) => {
              const bgColor = indicator.complianceLevel === 'pending'
                ? '#f5f5f5'
                : indicator.complianceLevel === 'compliant'
                ? '#f6ffed'
                : indicator.complianceLevel === 'basic'
                ? '#fffbe6'
                : '#fff2f0';
              const borderColor = indicator.complianceLevel === 'pending'
                ? '#d9d9d9'
                : indicator.complianceLevel === 'compliant'
                ? '#b7eb8f'
                : indicator.complianceLevel === 'basic'
                ? '#ffe58f'
                : '#ffccc7';

              return (
                <Col xs={24} sm={12} md={8} lg={6} key={indicator.code}>
                  <Card
                    size="small"
                    style={{ background: bgColor, borderColor }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Tooltip title={indicator.name}>
                        <span style={{ fontSize: 13, color: '#6b7280' }}>
                          {indicator.code}. {indicator.name.length > 8 ? indicator.name.substring(0, 8) + '...' : indicator.name}
                        </span>
                      </Tooltip>
                      <Tag color={getComplianceLevelColor(indicator.complianceLevel)}>
                        {getComplianceLevelText(indicator.complianceLevel)}
                      </Tag>
                    </div>
                  </Card>
                </Col>
              );
            })}
            {/* 综合判定卡片 */}
            <Col xs={24} sm={12} md={8} lg={6}>
              {renderComplianceLevelCard()}
            </Col>
          </Row>
        ) : (
          <Empty description="暂无综合达标情况数据" />
        )}
      </Card>

      {/* 等级判定标准说明 */}
      {overallComplianceData?.config && (
        <Card
          title="学前双普等级判定标准"
          size="small"
          style={{ marginBottom: 24 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
                <div style={{ fontWeight: 600, color: '#52c41a', marginBottom: 8 }}>
                  {overallComplianceData.config.levels.excellence.name}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {overallComplianceData.config.totalIndicators}项指标全部合格
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff' }}>
                <div style={{ fontWeight: 600, color: '#1890ff', marginBottom: 8 }}>
                  {overallComplianceData.config.levels.improved.name}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  至少{overallComplianceData.config.levels.improved.minCompliant}项合格，最多{overallComplianceData.config.levels.improved.maxBasicCompliant}项基本合格
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small" style={{ background: '#f0f5ff', borderColor: '#adc6ff' }}>
                <div style={{ fontWeight: 600, color: '#597ef7', marginBottom: 8 }}>
                  {overallComplianceData.config.levels.consolidated.name}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  至少{overallComplianceData.config.levels.consolidated.minCompliant}项合格，最多{overallComplianceData.config.levels.consolidated.maxBasicCompliant}项基本合格
                </div>
              </Card>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default PreschoolIndicatorSummary;
