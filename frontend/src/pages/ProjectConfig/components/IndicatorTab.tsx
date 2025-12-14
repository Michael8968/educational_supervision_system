/**
 * 指标体系 Tab 组件
 * 显示项目关联的指标体系和映射统计
 * 支持编辑数据指标与评估要素的关联
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Tree,
  Tag,
  Spin,
  Empty,
  Progress,
  Card,
  Statistic,
  Row,
  Col,
  Tooltip,
  message,
  Badge,
} from 'antd';
import {
  FileTextOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  EyeOutlined,
  ReloadOutlined,
  EditOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import * as indicatorService from '../../../services/indicatorService';
import * as projectService from '../../../services/projectService';
import type { Indicator, DataIndicator, SupportingMaterial, DataIndicatorWithElements } from '../../../services/indicatorService';
import type { IndicatorMappingSummary } from '../../../services/projectService';
import ElementAssociationDrawer from './ElementAssociationDrawer';
import styles from '../index.module.css';

// Mock 数据导入
import { indicatorTrees, dataIndicatorElements } from '../../../mock/data';

// Mock 模式开关
const USE_MOCK = process.env.REACT_APP_USE_MOCK === 'true' || true;

interface IndicatorTabProps {
  projectId: string;
  indicatorSystemId?: string;
  indicatorSystemName?: string;
}

const IndicatorTab: React.FC<IndicatorTabProps> = ({
  projectId,
  indicatorSystemId,
  indicatorSystemName,
}) => {
  const [loading, setLoading] = useState(false);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [mappingSummary, setMappingSummary] = useState<IndicatorMappingSummary | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  // 要素关联编辑状态
  const [elementAssociations, setElementAssociations] = useState<Map<string, DataIndicatorWithElements>>(new Map());
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedDataIndicator, setSelectedDataIndicator] = useState<DataIndicator | null>(null);
  const [selectedIndicatorName, setSelectedIndicatorName] = useState<string>('');

  // 加载指标体系树和映射统计
  const loadData = useCallback(async () => {
    if (!indicatorSystemId) return;

    setLoading(true);
    try {
      let treeData: Indicator[];
      let summaryData: IndicatorMappingSummary | null = null;
      let elementsData: DataIndicatorWithElements[];

      if (USE_MOCK) {
        // 使用 Mock 数据
        treeData = indicatorTrees[indicatorSystemId] || [];
        elementsData = dataIndicatorElements[indicatorSystemId] || [];

        // 构建 Mock 映射统计
        const allDataIndicators: Array<{ id: string; isMapped: boolean; mapping: any }> = [];
        const collectDataIndicators = (indicators: Indicator[]) => {
          indicators.forEach(ind => {
            if (ind.dataIndicators) {
              ind.dataIndicators.forEach(di => {
                const diWithElements = elementsData.find(e => e.id === di.id);
                allDataIndicators.push({
                  id: di.id,
                  isMapped: (diWithElements?.elements?.length || 0) > 0,
                  mapping: diWithElements?.elements?.[0] ? {
                    toolId: '6',
                    toolName: '优质均衡采集表-学校',
                    fieldId: 'mock_field',
                    fieldLabel: diWithElements.elements[0].elementName,
                  } : null,
                });
              });
            }
            if (ind.children) {
              collectDataIndicators(ind.children);
            }
          });
        };
        collectDataIndicators(treeData);

        summaryData = {
          project: {
            id: projectId,
            name: '2024年沈阳市义务教育优质均衡发展督导评估',
            indicatorSystemId: indicatorSystemId,
            indicatorSystemName: '义务教育优质均衡发展评估指标体系（2024版）',
          },
          dataIndicators: allDataIndicators as any,
          stats: {
            total: allDataIndicators.length,
            mapped: allDataIndicators.filter(d => d.isMapped).length,
            unmapped: allDataIndicators.filter(d => !d.isMapped).length,
          },
        };
      } else {
        // 使用 API 数据
        const [apiTreeData, apiSummaryData, apiElementsData] = await Promise.all([
          indicatorService.getIndicatorTree(indicatorSystemId),
          projectService.getIndicatorMappingSummary(projectId),
          indicatorService.getSystemDataIndicatorElements(indicatorSystemId),
        ]);
        treeData = apiTreeData;
        summaryData = apiSummaryData;
        elementsData = apiElementsData;
      }

      setIndicators(treeData);
      setMappingSummary(summaryData);

      // 构建要素关联映射
      const assocMap = new Map<string, DataIndicatorWithElements>();
      elementsData.forEach(di => {
        assocMap.set(di.id, di);
      });
      setElementAssociations(assocMap);

      // 默认展开第一级
      const firstLevelKeys = treeData.map(item => item.id);
      setExpandedKeys(firstLevelKeys);
    } catch (error) {
      console.error('加载指标体系失败:', error);
      message.error('加载指标体系失败');
    } finally {
      setLoading(false);
    }
  }, [indicatorSystemId, projectId]);

  // 打开要素关联编辑抽屉
  const handleEditElementAssociation = (di: DataIndicator, indicatorName: string) => {
    setSelectedDataIndicator(di);
    setSelectedIndicatorName(indicatorName);
    setDrawerVisible(true);
  };

  // 获取数据指标的要素关联数量
  const getElementCount = (dataIndicatorId: string): number => {
    const assoc = elementAssociations.get(dataIndicatorId);
    return assoc?.elements?.length || 0;
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 检查数据指标是否已映射
  const isDataIndicatorMapped = (dataIndicatorId: string): boolean => {
    if (!mappingSummary) return false;
    const indicator = mappingSummary.dataIndicators.find(d => d.id === dataIndicatorId);
    return indicator?.isMapped || false;
  };

  // 获取数据指标的映射信息
  const getDataIndicatorMapping = (dataIndicatorId: string) => {
    if (!mappingSummary) return null;
    const indicator = mappingSummary.dataIndicators.find(d => d.id === dataIndicatorId);
    return indicator?.mapping || null;
  };

  // 渲染数据指标节点
  const renderDataIndicatorNode = (di: DataIndicator, indicatorId: string, indicatorName: string) => {
    const isMapped = isDataIndicatorMapped(di.id);
    const mapping = getDataIndicatorMapping(di.id);
    const elementCount = getElementCount(di.id);

    return (
      <div className={styles.dataIndicatorNode}>
        <span className={styles.diCode}>{di.code}</span>
        <span className={styles.diName}>{di.name}</span>
        {di.threshold && (
          <Tag color="blue" className={styles.diThreshold}>
            阈值: {di.threshold}
          </Tag>
        )}
        {isMapped ? (
          <Tooltip title={mapping ? `已关联: ${mapping.toolName} - ${mapping.fieldLabel}` : '已映射'}>
            <Tag color="success" icon={<CheckCircleOutlined />}>
              已映射
            </Tag>
          </Tooltip>
        ) : (
          <Tooltip title="未关联采集工具字段">
            <Tag color="warning" icon={<ExclamationCircleOutlined />}>
              未映射
            </Tag>
          </Tooltip>
        )}
        {/* 要素关联状态 */}
        <Tooltip title={elementCount > 0 ? `已关联 ${elementCount} 个评估要素` : '点击编辑关联评估要素'}>
          <Tag
            color={elementCount > 0 ? 'cyan' : 'default'}
            icon={<DatabaseOutlined />}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              handleEditElementAssociation(di, indicatorName);
            }}
          >
            要素 {elementCount}
          </Tag>
        </Tooltip>
        {/* 编辑按钮 */}
        <Tooltip title="编辑要素关联">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleEditElementAssociation(di, indicatorName);
            }}
            style={{ marginLeft: 4 }}
          />
        </Tooltip>
      </div>
    );
  };

  // 渲染佐证资料节点
  const renderMaterialNode = (material: SupportingMaterial) => {
    return (
      <div className={styles.materialNode}>
        <FileTextOutlined className={styles.materialIcon} />
        <span className={styles.materialName}>{material.name}</span>
        {material.required ? (
          <Tag color="red">必传</Tag>
        ) : (
          <Tag>选传</Tag>
        )}
        <span className={styles.materialTypes}>
          {material.fileTypes} | {material.maxSize}
        </span>
      </div>
    );
  };

  // 构建树形数据
  const buildTreeData = (indicatorList: Indicator[]): DataNode[] => {
    return indicatorList.map(indicator => {
      const children: DataNode[] = [];

      // 添加子指标
      if (indicator.children && indicator.children.length > 0) {
        children.push(...buildTreeData(indicator.children));
      }

      // 添加数据指标
      if (indicator.dataIndicators && indicator.dataIndicators.length > 0) {
        children.push({
          key: `${indicator.id}-data-indicators`,
          title: (
            <span className={styles.groupTitle}>
              <LinkOutlined /> 数据指标 ({indicator.dataIndicators.length})
            </span>
          ),
          selectable: false,
          children: indicator.dataIndicators.map(di => ({
            key: `di-${di.id}`,
            title: renderDataIndicatorNode(di, indicator.id, indicator.name),
            isLeaf: true,
            selectable: false,
          })),
        });
      }

      // 添加佐证资料
      if (indicator.supportingMaterials && indicator.supportingMaterials.length > 0) {
        children.push({
          key: `${indicator.id}-materials`,
          title: (
            <span className={styles.groupTitle}>
              <FileTextOutlined /> 佐证资料 ({indicator.supportingMaterials.length})
            </span>
          ),
          selectable: false,
          children: indicator.supportingMaterials.map(material => ({
            key: `material-${material.id}`,
            title: renderMaterialNode(material),
            isLeaf: true,
            selectable: false,
          })),
        });
      }

      // 获取层级颜色
      const levelColors: Record<number, string> = {
        1: 'blue',
        2: 'green',
        3: 'orange',
      };

      return {
        key: indicator.id,
        title: (
          <div className={styles.indicatorNode}>
            <Tag color={levelColors[indicator.level] || 'default'}>
              {indicator.level}级
            </Tag>
            <span className={styles.indicatorCode}>{indicator.code}</span>
            <span className={styles.indicatorName}>{indicator.name}</span>
            {indicator.weight && (
              <span className={styles.indicatorWeight}>权重: {indicator.weight}%</span>
            )}
          </div>
        ),
        children: children.length > 0 ? children : undefined,
        icon: ({ expanded }: { expanded?: boolean }) =>
          expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
      };
    });
  };

  // 如果没有关联指标体系
  if (!indicatorSystemId) {
    return (
      <div className={styles.indicatorTab}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂未关联指标体系"
        >
          <Button type="primary" icon={<LinkOutlined />}>
            关联指标体系
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.indicatorTab}>
      {/* 指标体系信息头 */}
      <div className={styles.indicatorHeader}>
        <div className={styles.indicatorInfo}>
          <h3 className={styles.indicatorSystemName}>
            <FileTextOutlined /> {indicatorSystemName || '指标体系'}
          </h3>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => window.open(`/indicator-library`, '_blank')}
          >
            查看完整体系
          </Button>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadData}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {/* 映射统计卡片 */}
      {mappingSummary && (
        <Card className={styles.mappingStatsCard} size="small">
          <Row gutter={24}>
            <Col span={6}>
              <Statistic
                title="数据指标总数"
                value={mappingSummary.stats.total}
                suffix="项"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="已映射"
                value={mappingSummary.stats.mapped}
                suffix="项"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="未映射"
                value={mappingSummary.stats.unmapped}
                suffix="项"
                valueStyle={{ color: mappingSummary.stats.unmapped > 0 ? '#faad14' : '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <div className={styles.mappingProgress}>
                <span className={styles.progressLabel}>映射完成度</span>
                <Progress
                  percent={Math.round((mappingSummary.stats.mapped / mappingSummary.stats.total) * 100)}
                  status={mappingSummary.stats.unmapped > 0 ? 'active' : 'success'}
                  size="small"
                />
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* 指标树 */}
      <div className={styles.indicatorTreeContainer}>
        <Spin spinning={loading}>
          {indicators.length > 0 ? (
            <Tree
              showLine={{ showLeafIcon: false }}
              showIcon
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys)}
              treeData={buildTreeData(indicators)}
              className={styles.indicatorTree}
            />
          ) : (
            <Empty description="暂无指标数据" />
          )}
        </Spin>
      </div>

      {/* 要素关联编辑抽屉 */}
      <ElementAssociationDrawer
        visible={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedDataIndicator(null);
        }}
        dataIndicator={selectedDataIndicator}
        indicatorName={selectedIndicatorName}
        onSaved={loadData}
      />
    </div>
  );
};

export default IndicatorTab;
