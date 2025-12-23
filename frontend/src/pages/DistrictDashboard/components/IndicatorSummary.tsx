/**
 * 指标汇总入口组件
 *
 * 根据项目的评估类型（assessmentType）选择渲染对应的指标汇总组件：
 * - 普及普惠：PreschoolIndicatorSummary
 * - 优质均衡：BalancedIndicatorSummary
 */
import React from 'react';
import { Empty } from 'antd';
import PreschoolIndicatorSummary from './PreschoolIndicatorSummary';
import BalancedIndicatorSummary from './BalancedIndicatorSummary';

interface IndicatorSummaryProps {
  districtId: string;
  projectId: string;
  refreshKey?: number;
  assessmentType?: '普及普惠' | '优质均衡';
}

const IndicatorSummary: React.FC<IndicatorSummaryProps> = ({
  districtId,
  projectId,
  refreshKey,
  assessmentType,
}) => {
  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  // 根据评估类型选择对应的组件
  if (assessmentType === '普及普惠') {
    return (
      <PreschoolIndicatorSummary
        districtId={districtId}
        projectId={projectId}
        refreshKey={refreshKey}
      />
    );
  }

  // 默认显示优质均衡指标汇总
  return (
    <BalancedIndicatorSummary
      districtId={districtId}
      projectId={projectId}
      refreshKey={refreshKey}
    />
  );
};

export default IndicatorSummary;
