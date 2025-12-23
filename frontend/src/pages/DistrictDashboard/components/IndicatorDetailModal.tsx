/**
 * 指标详情弹窗组件
 *
 * 显示指标的数据来源、计算公式和详细数据
 */
import React from 'react';
import { Modal, Descriptions, Tag, Table, Divider, Typography, Empty } from 'antd';
import {
  DatabaseOutlined,
  CalculatorOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
  BankOutlined,
  SyncOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

// 指标详情数据结构
export interface IndicatorDetail {
  code: string;
  name: string;
  shortName?: string;
  type: string;
  threshold: string | number;
  description?: string;
  value?: number | string | null;
  displayValue?: string | null;
  isCompliant?: boolean | null;
  unit?: string;
  operator?: string;
  // 详细数据项（参与计算的字段）
  details?: Array<{
    id?: string;
    name: string;
    value: number | string | null;
    displayValue: string;
    threshold?: number | string;
    unit?: string;
    isCompliant?: boolean | null;
  }>;
  // 数据来源信息
  dataSource?: 'district' | 'school' | 'school_aggregate' | 'system' | string;
  // 计算公式
  formula?: string;
  // 数据字段定义
  dataFields?: Array<{
    id: string;
    name: string;
  }>;
}

interface IndicatorDetailModalProps {
  visible: boolean;
  onClose: () => void;
  indicator: IndicatorDetail | null;
}

// 数据来源配置
const DATA_SOURCE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  district: {
    label: '区县填报',
    color: 'purple',
    icon: <BankOutlined />,
    description: '由区县教育局在区县工作台填报的数据',
  },
  school: {
    label: '学校填报',
    color: 'blue',
    icon: <TeamOutlined />,
    description: '由各学校在学校工作台填报的数据',
  },
  school_aggregate: {
    label: '学校汇总',
    color: 'cyan',
    icon: <SyncOutlined />,
    description: '系统自动汇总各学校填报数据计算得出',
  },
  system: {
    label: '系统计算',
    color: 'green',
    icon: <CalculatorOutlined />,
    description: '系统根据填报数据自动计算得出',
  },
  material: {
    label: '佐证材料',
    color: 'orange',
    icon: <FileTextOutlined />,
    description: '需要上传相关佐证材料进行审核',
  },
};

// 指标类型配置
const INDICATOR_TYPE_CONFIG: Record<string, { label: string; description: string }> = {
  material: { label: '材料佐证型', description: '需要提供相关佐证材料' },
  boolean: { label: '是否判定型', description: '填报是/否进行判定' },
  boolean_negative: { label: '否定判定型', description: '填报是/否，选"否"为达标' },
  number: { label: '数值型', description: '填报具体数值进行判定' },
  comparison: { label: '比较型', description: '两个数值进行比较判定' },
  composite: { label: '组合型', description: '多个子指标组合判定' },
  calculated: { label: '计算型', description: '根据多个字段计算得出' },
  calculated_district: { label: '区县计算型', description: '根据区县填报数据计算' },
  school_aggregate: { label: '学校汇总型', description: '汇总各学校数据判定' },
  element_linked: { label: '要素关联型', description: '关联要素计算得出' },
  quality_monitoring: { label: '质量监测型', description: '质量监测数据判定' },
  school_material: { label: '学校材料型', description: '各学校提供佐证材料' },
  school_compliance: { label: '学校达标型', description: '各学校数据达标判定' },
  data: { label: '数据指标', description: '需要填报具体数值' },
  both: { label: '数据+材料', description: '需要填报数值并提供材料' },
};

// 获取计算公式说明
const getFormulaDescription = (indicator: IndicatorDetail): string | null => {
  const { type, description, dataFields, details } = indicator;

  // 从描述中提取公式
  if (description) {
    // 检查描述中是否包含公式
    const formulaMatch = description.match(/[=＝].*[×÷+\-*/]/);
    if (formulaMatch) {
      return description;
    }
  }

  // 根据类型生成公式说明
  if (type === 'calculated_district' && dataFields && dataFields.length > 0) {
    const fieldNames = dataFields.map(f => f.name).join('、');
    return `根据 ${fieldNames} 计算得出`;
  }

  if (type === 'comparison' && details && details.length >= 2) {
    return `比较 ${details[0]?.name} 与 ${details[1]?.name}`;
  }

  if (type === 'school_aggregate') {
    return '汇总所有学校数据，判定是否全部达标';
  }

  if (type === 'composite' && details && details.length > 0) {
    const subIndicators = details.map(d => d.name).join('、');
    return `组合判定：${subIndicators}`;
  }

  return null;
};

// 获取数据来源
const getDataSource = (indicator: IndicatorDetail): string => {
  if (indicator.dataSource) {
    return indicator.dataSource;
  }

  // 根据类型推断数据来源
  const { type } = indicator;
  if (type === 'material' || type === 'boolean' || type === 'boolean_negative') {
    return 'district';
  }
  if (type === 'school_aggregate' || type === 'school_material' || type === 'school_compliance') {
    return 'school_aggregate';
  }
  if (type === 'calculated_district' || type === 'comparison' || type === 'composite' || type === 'element_linked') {
    return 'district';
  }
  if (type === 'quality_monitoring') {
    return 'district';
  }

  return 'system';
};

const IndicatorDetailModal: React.FC<IndicatorDetailModalProps> = ({
  visible,
  onClose,
  indicator,
}) => {
  if (!indicator) {
    return null;
  }

  const dataSource = getDataSource(indicator);
  const dataSourceConfig = DATA_SOURCE_CONFIG[dataSource] || DATA_SOURCE_CONFIG.system;
  const typeConfig = INDICATOR_TYPE_CONFIG[indicator.type] || { label: indicator.type, description: '' };
  const formulaDescription = getFormulaDescription(indicator);

  // 详细数据表格列
  const detailColumns = [
    {
      title: '数据项',
      dataIndex: 'name',
      key: 'name',
      width: '40%',
    },
    {
      title: '数值',
      dataIndex: 'displayValue',
      key: 'displayValue',
      width: '30%',
      render: (text: string, record: any) => (
        <span style={{ color: record.isCompliant === false ? '#ff4d4f' : '#333' }}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: '30%',
      render: (_: any, record: any) => {
        if (record.isCompliant === null || record.isCompliant === undefined) {
          return <Tag color="default">-</Tag>;
        }
        return record.isCompliant ? (
          <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
        );
      },
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DatabaseOutlined style={{ color: '#1890ff' }} />
          <span>指标详情</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      {/* 基本信息 */}
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="指标编码" span={1}>
          <Text code>{indicator.code}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="当前状态" span={1}>
          {indicator.isCompliant === null || indicator.isCompliant === undefined ? (
            <Tag color="default">待填报</Tag>
          ) : indicator.isCompliant ? (
            <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
          ) : (
            <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="指标名称" span={2}>
          {indicator.name}
        </Descriptions.Item>
        <Descriptions.Item label="达标标准" span={2}>
          <Text strong>
            {typeof indicator.threshold === 'number'
              ? `${indicator.operator || '≥'}${indicator.threshold}${indicator.unit || ''}`
              : indicator.threshold}
          </Text>
        </Descriptions.Item>
        {indicator.displayValue && (
          <Descriptions.Item label="当前值" span={2}>
            <Text
              strong
              style={{ color: indicator.isCompliant ? '#52c41a' : indicator.isCompliant === false ? '#ff4d4f' : '#666' }}
            >
              {indicator.displayValue}
            </Text>
          </Descriptions.Item>
        )}
      </Descriptions>

      <Divider style={{ margin: '16px 0' }} />

      {/* 数据来源 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <DatabaseOutlined style={{ color: '#722ed1' }} />
          <Text strong>数据来源</Text>
        </div>
        <div style={{ padding: '12px 16px', background: '#f5f5f5', borderRadius: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Tag icon={dataSourceConfig.icon} color={dataSourceConfig.color}>
              {dataSourceConfig.label}
            </Tag>
            <Tag>{typeConfig.label}</Tag>
          </div>
          <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
            {dataSourceConfig.description}
            {typeConfig.description && ` - ${typeConfig.description}`}
          </Paragraph>
        </div>
      </div>

      {/* 计算公式 */}
      {formulaDescription && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <CalculatorOutlined style={{ color: '#52c41a' }} />
            <Text strong>计算公式</Text>
          </div>
          <div style={{ padding: '12px 16px', background: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f' }}>
            <Paragraph style={{ margin: 0, fontSize: 13 }}>
              {formulaDescription}
            </Paragraph>
          </div>
        </div>
      )}

      {/* 指标说明 */}
      {indicator.description && !formulaDescription?.includes(indicator.description) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <FileTextOutlined style={{ color: '#faad14' }} />
            <Text strong>指标说明</Text>
          </div>
          <div style={{ padding: '12px 16px', background: '#fffbe6', borderRadius: 6, border: '1px solid #ffe58f' }}>
            <Paragraph style={{ margin: 0, fontSize: 13 }}>
              {indicator.description}
            </Paragraph>
          </div>
        </div>
      )}

      {/* 详细数据 */}
      {indicator.details && indicator.details.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TeamOutlined style={{ color: '#1890ff' }} />
            <Text strong>计算数据明细</Text>
          </div>
          <Table
            columns={detailColumns}
            dataSource={indicator.details.map((d, i) => ({ ...d, key: i }))}
            pagination={false}
            size="small"
            bordered
          />
        </div>
      )}

      {/* 无详细数据时的提示 */}
      {(!indicator.details || indicator.details.length === 0) && !formulaDescription && (
        <Empty
          description="暂无更多详细信息"
          style={{ margin: '24px 0' }}
        />
      )}
    </Modal>
  );
};

export default IndicatorDetailModal;
