/**
 * 学校/幼儿园填报入口组件
 *
 * 根据项目的评估类型（assessmentType）选择渲染对应的填报列表组件：
 * - 普及普惠：PreschoolSubmissionList（幼儿园）
 * - 优质均衡：BalancedSubmissionList（小学、初中等）
 */
import React from 'react';
import { Empty } from 'antd';
import PreschoolSubmissionList from './PreschoolSubmissionList';
import BalancedSubmissionList from './BalancedSubmissionList';

interface SubmissionListProps {
  districtId: string;
  projectId: string;
  assessmentType?: '普及普惠' | '优质均衡';
}

const SubmissionList: React.FC<SubmissionListProps> = ({
  districtId,
  projectId,
  assessmentType,
}) => {
  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  // 根据评估类型选择对应的组件
  if (assessmentType === '普及普惠') {
    return (
      <PreschoolSubmissionList
        districtId={districtId}
        projectId={projectId}
      />
    );
  }

  // 默认显示优质均衡学校填报
  return (
    <BalancedSubmissionList
      districtId={districtId}
      projectId={projectId}
    />
  );
};

export default SubmissionList;
