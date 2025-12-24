/**
 * 填报学校管理 Hook
 * 用于管理项目配置中的填报学校（区县和学校）
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { message, Modal } from 'antd';
import * as sampleService from '../../../services/sampleService';

// 填报学校类型
export interface SubmissionSchool {
  id: string;
  name: string;
  code?: string;
  schoolType: string;
  parentId: string;
}

// 填报区县类型（包含学校列表）
export interface SubmissionDistrict {
  id: string;
  name: string;
  code?: string;
  schools: SubmissionSchool[];
}

// 区县表单值
export interface DistrictFormValues {
  name: string;
  code?: string;
}

// 学校表单值
export interface SchoolFormValues {
  name: string;
  code?: string;
  schoolType: string;
}

// 将 API 响应转换为前端树形结构
function convertApiToTree(apiSamples: sampleService.Sample[]): SubmissionDistrict[] {
  const districts: SubmissionDistrict[] = [];
  const districtMap = new Map<string, SubmissionDistrict>();

  // 展平树形结构
  const flatSamples: sampleService.Sample[] = [];
  const flatten = (samples: sampleService.Sample[]) => {
    samples.forEach(s => {
      flatSamples.push(s);
      if (s.children && s.children.length > 0) {
        flatten(s.children);
      }
    });
  };
  flatten(apiSamples);

  // 首先处理区县
  flatSamples
    .filter(s => s.type === 'district')
    .forEach(d => {
      const district: SubmissionDistrict = {
        id: d.id,
        name: d.name,
        code: d.code,
        schools: [],
      };
      districtMap.set(d.id, district);
      districts.push(district);
    });

  // 然后处理学校
  flatSamples
    .filter(s => s.type === 'school')
    .forEach(s => {
      const school: SubmissionSchool = {
        id: s.id,
        name: s.name,
        code: s.code,
        schoolType: s.schoolType || '小学',
        parentId: s.parentId || '',
      };

      // 添加到对应区县
      if (s.parentId && districtMap.has(s.parentId)) {
        districtMap.get(s.parentId)!.schools.push(school);
      }
    });

  return districts;
}

export function useSubmissionSchools(projectId?: string) {
  const [districts, setDistricts] = useState<SubmissionDistrict[]>([]);
  const [expandedDistricts, setExpandedDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [schoolTypeFilter, setSchoolTypeFilter] = useState<string>('all');

  // 加载数据
  const loadData = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const data = await sampleService.getSamples(projectId);

      // 将 API 数据转换为树形结构
      const treeData = convertApiToTree(data);

      setDistricts(treeData);

      // 默认展开所有区县
      if (treeData.length > 0 && expandedDistricts.length === 0) {
        setExpandedDistricts(treeData.map(d => d.id));
      }
    } catch (error) {
      console.error('加载填报学校数据失败:', error);
      message.error('加载填报学校数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, expandedDistricts.length]);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 切换区县展开
  const toggleDistrictExpand = useCallback((districtId: string) => {
    setExpandedDistricts(prev =>
      prev.includes(districtId)
        ? prev.filter(id => id !== districtId)
        : [...prev, districtId]
    );
  }, []);

  // 添加区县
  const addDistrict = useCallback(async (values: DistrictFormValues) => {
    if (!projectId) return;

    try {
      await sampleService.addDistrictSample(projectId, {
        name: values.name,
        code: values.code,
      });
      message.success('区县添加成功');
      loadData();
    } catch (error) {
      console.error('添加区县失败:', error);
      message.error('添加区县失败');
    }
  }, [projectId, loadData]);

  // 添加学校
  const addSchool = useCallback(async (districtId: string, values: SchoolFormValues) => {
    if (!projectId) return;

    try {
      await sampleService.addSchoolSample(projectId, {
        parentId: districtId,
        name: values.name,
        code: values.code,
        schoolType: values.schoolType,
        teacherSampleMode: 'self',
      });
      message.success('学校添加成功');
      loadData();
    } catch (error) {
      console.error('添加学校失败:', error);
      message.error('添加学校失败');
    }
  }, [projectId, loadData]);

  // 删除区县
  const deleteDistrict = useCallback((districtId: string) => {
    if (!projectId) return;

    const district = districts.find(d => d.id === districtId);
    const schoolCount = district?.schools.length || 0;

    Modal.confirm({
      title: '确认删除区县',
      content: schoolCount > 0
        ? `删除区县将同时删除其下 ${schoolCount} 所学校，确定要删除吗？`
        : '确定要删除该区县吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await sampleService.deleteSample(projectId, districtId);
          message.success('删除成功');
          loadData();
        } catch (error) {
          console.error('删除区县失败:', error);
          message.error('删除区县失败');
        }
      },
    });
  }, [projectId, districts, loadData]);

  // 删除学校
  const deleteSchool = useCallback((schoolId: string) => {
    if (!projectId) return;

    Modal.confirm({
      title: '确认删除学校',
      content: '确定要删除该学校吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await sampleService.deleteSample(projectId, schoolId);
          message.success('删除成功');
          loadData();
        } catch (error) {
          console.error('删除学校失败:', error);
          message.error('删除学校失败');
        }
      },
    });
  }, [projectId, loadData]);

  // 按学校类型筛选后的区县数据
  const filteredDistricts = useMemo(() => {
    if (schoolTypeFilter === 'all') {
      return districts;
    }

    return districts.map(district => ({
      ...district,
      schools: district.schools.filter(school => school.schoolType === schoolTypeFilter),
    })).filter(district => district.schools.length > 0 || schoolTypeFilter === 'all');
  }, [districts, schoolTypeFilter]);

  // 获取所有区县（供填报账号Tab使用）
  const getAllDistricts = useCallback(() => {
    return districts.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code,
    }));
  }, [districts]);

  // 获取所有学校（供填报账号Tab使用）
  const getAllSchools = useCallback(() => {
    return districts.flatMap(d =>
      d.schools.map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        schoolType: s.schoolType,
        districtId: d.id,
        districtName: d.name,
      }))
    );
  }, [districts]);

  // 统计信息
  const statistics = useMemo(() => {
    const totalDistricts = districts.length;
    const totalSchools = districts.reduce((sum, d) => sum + d.schools.length, 0);
    const schoolsByType = districts.reduce((acc, d) => {
      d.schools.forEach(s => {
        acc[s.schoolType] = (acc[s.schoolType] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    return {
      totalDistricts,
      totalSchools,
      schoolsByType,
    };
  }, [districts]);

  // 根据区县ID获取区县名称
  const getDistrictById = useCallback((districtId: string) => {
    return districts.find(d => d.id === districtId);
  }, [districts]);

  // 批量导入学校（从Excel解析后的数据）
  const importSchools = useCallback(async (
    importDistricts: Array<{
      code: string;
      name: string;
      schools: Array<{
        schoolCode: string;
        schoolName: string;
        schoolType: string;
      }>;
    }>
  ): Promise<{ success: number; failed: number; errors: string[] }> => {
    if (!projectId) {
      return { success: 0, failed: 0, errors: ['项目ID不存在'] };
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // 逐个处理区县及其学校
    for (const importDistrict of importDistricts) {
      try {
        // 检查区县是否已存在
        let districtId = districts.find(d => d.name === importDistrict.name)?.id;

        // 如果不存在，创建新区县
        if (!districtId) {
          const result = await sampleService.addDistrictSample(projectId, {
            name: importDistrict.name,
            code: importDistrict.code,
          });
          districtId = result.id;
        }

        // 添加学校
        for (const school of importDistrict.schools) {
          try {
            await sampleService.addSchoolSample(projectId, {
              parentId: districtId,
              name: school.schoolName,
              code: school.schoolCode,
              schoolType: school.schoolType,
              teacherSampleMode: 'self',
            });
            success++;
          } catch (err) {
            failed++;
            errors.push(`学校 "${school.schoolName}" 导入失败`);
            console.error(`添加学校失败: ${school.schoolName}`, err);
          }
        }
      } catch (err) {
        failed += importDistrict.schools.length;
        errors.push(`区县 "${importDistrict.name}" 及其下属学校导入失败`);
        console.error(`处理区县失败: ${importDistrict.name}`, err);
      }
    }

    // 刷新数据
    await loadData();

    return { success, failed, errors };
  }, [projectId, districts, loadData]);

  return {
    districts,
    filteredDistricts,
    expandedDistricts,
    loading,
    schoolTypeFilter,
    setSchoolTypeFilter,
    toggleDistrictExpand,
    addDistrict,
    addSchool,
    deleteDistrict,
    deleteSchool,
    getAllDistricts,
    getAllSchools,
    getDistrictById,
    statistics,
    loadData,
    importSchools,
  };
}
