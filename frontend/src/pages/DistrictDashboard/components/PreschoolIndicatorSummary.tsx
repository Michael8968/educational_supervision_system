/**
 * 普及普惠指标汇总组件
 *
 * 显示学前教育普及普惠督导评估的指标汇总：
 * - 维度一：普及普惠水平（3项指标）
 * - 维度二：政府保障情况（11项指标）
 * - 维度三：幼儿园保教质量保障情况（6项指标）
 * - 综合达标情况与等级判定
 * - 学前双普等级判定标准
 */
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Spin, Empty, Tag, Tooltip, Alert, Divider, Progress } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  BarChartOutlined,
  SafetyOutlined,
  TeamOutlined,
  BankOutlined,
} from '@ant-design/icons';
import {
  getUniversalizationSummary,
  getOverallCompliance,
  UniversalizationSummary,
  OverallComplianceResponse,
  IndicatorData,
  IndicatorEvaluation,
  getComplianceLevelText,
  getComplianceLevelColor,
  getPreschoolLevelText,
  ComplianceLevel,
} from '../../../services/preschoolStatisticsService';

interface PreschoolIndicatorSummaryProps {
  districtId: string;
  projectId: string;
  refreshKey?: number;
}

// 指标维度定义
interface IndicatorDimension {
  code: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  indicatorCodes: string[];
  weight: number;
}

// 三大维度配置
const INDICATOR_DIMENSIONS: IndicatorDimension[] = [
  {
    code: '1',
    name: '普及普惠水平',
    description: '3项指标均要达到要求：学前三年毛入园率≥85%、普惠性幼儿园覆盖率≥80%、公办园在园幼儿占比≥50%',
    icon: <BarChartOutlined />,
    color: '#1890ff',
    indicatorCodes: ['1.1', '1.2', '1.3'],
    weight: 30,
  },
  {
    code: '2',
    name: '政府保障情况',
    description: '11项指标均要达到要求（以政策落实、保障机制与关键约束为主）',
    icon: <BankOutlined />,
    color: '#722ed1',
    indicatorCodes: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9', '2.10', '2.11'],
    weight: 40,
  },
  {
    code: '3',
    name: '幼儿园保教质量保障情况',
    description: '6项指标均要达到要求（含办园条件、师资队伍、保教质量等）',
    icon: <TeamOutlined />,
    color: '#52c41a',
    indicatorCodes: ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6'],
    weight: 30,
  },
];

// 指标详情配置（用于显示指标类型）
const INDICATOR_DETAILS: Record<string, { type: 'data' | 'material' | 'both'; label: string }> = {
  // 维度一：普及普惠水平
  '1.1': { type: 'data', label: '学前三年毛入园率' },
  '1.2': { type: 'both', label: '普惠性幼儿园覆盖率' },  // 数据指标 + 佐证材料（公办园和普惠性民办园名单公示网址）
  '1.3': { type: 'data', label: '公办园在园幼儿占比' },
  // 维度二：政府保障情况
  '2.1': { type: 'material', label: '党的领导坚强有力' },
  '2.2': { type: 'material', label: '发展规划科学合理' },
  '2.3': { type: 'material', label: '公共服务网络基本完善' },
  '2.4': { type: 'data', label: '小区配套幼儿园管理规范' },
  '2.5': { type: 'data', label: '财政投入到位' },
  '2.6': { type: 'data', label: '收费合理' },
  '2.7': { type: 'data', label: '教师工资待遇有保障' },
  '2.8': { type: 'material', label: '安全风险防控机制健全' },
  '2.9': { type: 'material', label: '监管制度比较完善' },
  '2.10': { type: 'material', label: '办园条件改善' },
  '2.11': { type: 'data', label: '无重大安全责任事故' },
  // 维度三：幼儿园保教质量保障情况
  '3.1': { type: 'data', label: '办园条件合格' },
  '3.2': { type: 'data', label: '班额基本达标' },
  '3.3': { type: 'data', label: '教师配足配齐' },
  '3.4': { type: 'material', label: '教师管理制度严格' },
  '3.5': { type: 'material', label: '落实科学保教要求' },
  '3.6': { type: 'material', label: '无"小学化"现象' },
};

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

  // 根据维度获取指标数据
  const getIndicatorsByDimension = (dimension: IndicatorDimension): IndicatorEvaluation[] => {
    if (!overallComplianceData?.indicators) return [];
    return overallComplianceData.indicators.filter(ind =>
      dimension.indicatorCodes.includes(ind.code)
    );
  };

  // 计算维度达标统计
  const getDimensionStats = (indicators: IndicatorEvaluation[]) => {
    const total = indicators.length;
    const compliant = indicators.filter(i => i.complianceLevel === 'compliant').length;
    const basic = indicators.filter(i => i.complianceLevel === 'basic').length;
    const nonCompliant = indicators.filter(i => i.complianceLevel === 'non-compliant').length;
    const pending = indicators.filter(i => i.complianceLevel === 'pending').length;
    const passRate = total > 0 ? Math.round(((compliant + basic) / total) * 100) : 0;
    return { total, compliant, basic, nonCompliant, pending, passRate };
  };

  // 渲染普及普惠水平指标卡片（带详细数值）
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

  // 渲染指标卡片（政府保障和保教质量）
  const renderIndicatorCard = (indicator: IndicatorEvaluation) => {
    const detail = INDICATOR_DETAILS[indicator.code];
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
      <Card
        size="small"
        style={{ background: bgColor, borderColor, height: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <Tooltip title={indicator.name}>
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 500, flex: 1 }}>
              {indicator.code}. {indicator.name.length > 12 ? indicator.name.substring(0, 12) + '...' : indicator.name}
            </span>
          </Tooltip>
          <Tag color={getComplianceLevelColor(indicator.complianceLevel)} style={{ marginLeft: 8 }}>
            {getComplianceLevelText(indicator.complianceLevel)}
          </Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {detail?.type === 'data' && (
            <Tag icon={<BarChartOutlined />} color="blue" style={{ fontSize: 10 }}>数据指标</Tag>
          )}
          {detail?.type === 'material' && (
            <Tag icon={<FileTextOutlined />} color="orange" style={{ fontSize: 10 }}>佐证材料</Tag>
          )}
          {detail?.type === 'both' && (
            <>
              <Tag icon={<BarChartOutlined />} color="blue" style={{ fontSize: 10 }}>数据指标</Tag>
              <Tag icon={<FileTextOutlined />} color="orange" style={{ fontSize: 10 }}>佐证材料</Tag>
            </>
          )}
        </div>
      </Card>
    );
  };

  // 渲染维度Card
  const renderDimensionCard = (dimension: IndicatorDimension) => {
    const indicators = getIndicatorsByDimension(dimension);
    const stats = getDimensionStats(indicators);

    // 对于维度一，使用带详细数值的卡片
    const isDimension1 = dimension.code === '1';

    return (
      <Card
        key={dimension.code}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: dimension.color, fontSize: 18 }}>{dimension.icon}</span>
              <span>维度{dimension.code}：{dimension.name}（{stats.total}项）</span>
              <Tag color="default" style={{ marginLeft: 8 }}>权重 {dimension.weight}%</Tag>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Progress
                percent={stats.passRate}
                size="small"
                style={{ width: 100 }}
                status={stats.nonCompliant > 0 ? 'exception' : stats.pending > 0 ? 'normal' : 'success'}
              />
              {stats.compliant === stats.total ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                  {stats.compliant}/{stats.total} 项达标
                </Tag>
              ) : stats.pending > 0 ? (
                <Tag icon={<ExclamationCircleOutlined />} color="warning">
                  {stats.compliant}/{stats.total} 项达标，{stats.pending} 项待填报
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="error">
                  {stats.compliant}/{stats.total} 项达标
                </Tag>
              )}
            </div>
          </div>
        }
        style={{ marginBottom: 24 }}
      >
        <div style={{ marginBottom: 12 }}>
          <Alert
            message={dimension.description}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </div>
        {isDimension1 && universalizationData?.indicators && universalizationData.indicators.length > 0 ? (
          <Row gutter={[16, 16]}>
            {universalizationData.indicators.map((indicator) => (
              <Col xs={24} sm={12} md={8} key={indicator.code}>
                {renderUniversalizationIndicatorCard(indicator)}
              </Col>
            ))}
          </Row>
        ) : indicators.length > 0 ? (
          <Row gutter={[12, 12]}>
            {indicators.map((indicator) => (
              <Col xs={24} sm={12} md={8} lg={6} key={indicator.code}>
                {renderIndicatorCard(indicator)}
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无指标数据" />
        )}
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
          <SafetyOutlined style={{ fontSize: 32, color: textColor, marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>综合达标等级</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: textColor, marginBottom: 12 }}>
            {complianceLevel ? getPreschoolLevelText(complianceLevel.level) : '待评估'}
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ fontSize: 13, color: '#666' }}>
            <div style={{ marginBottom: 4 }}>
              <Tag color="success">合格 {summary.compliantCount}</Tag>
              <Tag color="warning">基本合格 {summary.basicCount}</Tag>
            </div>
            <div>
              <Tag color="error">不合格 {summary.nonCompliantCount}</Tag>
              <Tag color="default">待填报 {summary.pendingCount}</Tag>
            </div>
          </div>
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
      {/* 顶部总览 */}
      <Alert
        message="学前教育普及普惠督导评估指标体系"
        description={
          <div>
            <p style={{ marginBottom: 8 }}>
              依据《县域学前教育普及普惠督导评估办法》，共3大维度、17项一级指标、36项二级指标。
              达标标准：29项合格+7项基本合格为巩固"学前双普"；31项合格+5项基本合格为提高"学前双普"；
              33项合格+3项基本合格为创优"学前双普"。
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <Tag icon={<BarChartOutlined />} color="blue">数据指标：需填报具体数值</Tag>
              <Tag icon={<FileTextOutlined />} color="orange">佐证材料：需上传相关文件</Tag>
            </div>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 三大维度指标 */}
      {INDICATOR_DIMENSIONS.map(dimension => renderDimensionCard(dimension))}

      {/* 综合达标情况与等级判定 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SafetyOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
              <span>综合达标情况与等级判定</span>
            </div>
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
            {/* 综合判定卡片 */}
            <Col xs={24} sm={24} md={8} lg={6}>
              {renderComplianceLevelCard()}
            </Col>
            {/* 等级判定标准说明 */}
            <Col xs={24} sm={24} md={16} lg={18}>
              {overallComplianceData.config && (
                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f', height: '100%' }}>
                      <div style={{ fontWeight: 600, color: '#52c41a', marginBottom: 8, fontSize: 15 }}>
                        {overallComplianceData.config.levels.excellence.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {overallComplianceData.config.totalIndicators}项指标全部合格，或33项合格+3项基本合格
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff', height: '100%' }}>
                      <div style={{ fontWeight: 600, color: '#1890ff', marginBottom: 8, fontSize: 15 }}>
                        {overallComplianceData.config.levels.improved.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        至少{overallComplianceData.config.levels.improved.minCompliant}项合格，
                        最多{overallComplianceData.config.levels.improved.maxBasicCompliant}项基本合格
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card size="small" style={{ background: '#f0f5ff', borderColor: '#adc6ff', height: '100%' }}>
                      <div style={{ fontWeight: 600, color: '#597ef7', marginBottom: 8, fontSize: 15 }}>
                        {overallComplianceData.config.levels.consolidated.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        至少{overallComplianceData.config.levels.consolidated.minCompliant}项合格，
                        最多{overallComplianceData.config.levels.consolidated.maxBasicCompliant}项基本合格
                      </div>
                    </Card>
                  </Col>
                </Row>
              )}
            </Col>
          </Row>
        ) : (
          <Empty description="暂无综合达标情况数据" />
        )}
      </Card>
    </div>
  );
};

export default PreschoolIndicatorSummary;
