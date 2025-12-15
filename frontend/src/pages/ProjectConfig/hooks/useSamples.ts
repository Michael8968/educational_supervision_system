/**
 * 样本管理 Hook
 */

import { useState, useCallback, useEffect } from 'react';
import { message, Modal } from 'antd';
import * as sampleService from '../../../services/sampleService';
import type { DistrictSample, SchoolSample, TeacherSample, SampleDataConfig, SampleFormValues, TeacherFormValues } from '../types';

// 默认样本数据对象配置
const defaultSampleDataConfig: SampleDataConfig = {
  district: true,
  school: true,
  grade: false,
  class: false,
  student: false,
  parent: false,
  department: false,
  teacher: true,
};

// 将 API 响应转换为前端树形结构
function convertApiToTree(apiSamples: sampleService.Sample[]): DistrictSample[] {
  const districts: DistrictSample[] = [];
  const schoolMap = new Map<string, SchoolSample>();
  const districtMap = new Map<string, DistrictSample>();

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
      const district: DistrictSample = {
        id: d.id,
        name: d.name,
        type: 'district',
        schools: [],
      };
      districtMap.set(d.id, district);
      districts.push(district);
    });

  // 然后处理学校
  flatSamples
    .filter(s => s.type === 'school')
    .forEach(s => {
      const school: SchoolSample = {
        id: s.id,
        name: s.name,
        type: 'school',
        teacherSampleMode: s.teacherSampleMode || 'self',
        teachers: [],
      };
      schoolMap.set(s.id, school);

      // 添加到对应区县
      if (s.parentId && districtMap.has(s.parentId)) {
        districtMap.get(s.parentId)!.schools.push(school);
      }
    });

  // 最后处理教师
  flatSamples
    .filter(s => s.type === 'teacher')
    .forEach(t => {
      const teacher: TeacherSample = {
        id: t.id,
        name: t.name,
        phone: t.phone || '',
      };

      // 添加到对应学校
      if (t.parentId && schoolMap.has(t.parentId)) {
        schoolMap.get(t.parentId)!.teachers.push(teacher);
      }
    });

  return districts;
}

export function useSamples(projectId?: string) {
  const [samples, setSamples] = useState<DistrictSample[]>([]);
  const [sampleDataConfig, setSampleDataConfig] = useState<SampleDataConfig>(defaultSampleDataConfig);
  const [expandedDistricts, setExpandedDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载样本数据
  const loadSamples = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const data = await sampleService.getSamples(projectId);

      // 将 API 数据转换为树形结构
      const treeData = convertApiToTree(data);

      setSamples(treeData);

      // 默认展开第一个区县
      if (treeData.length > 0 && expandedDistricts.length === 0) {
        setExpandedDistricts([treeData[0].id]);
      }
    } catch (error) {
      console.error('加载样本数据失败:', error);
      message.error('加载样本数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, expandedDistricts.length]);

  // 加载样本配置
  const loadSampleConfig = useCallback(async () => {
    if (!projectId) return;

    try {
      const config = await sampleService.getSampleConfig(projectId);
      setSampleDataConfig({
        district: config.district,
        school: config.school,
        grade: config.grade,
        class: config.class,
        student: config.student,
        parent: config.parent,
        department: config.department,
        teacher: config.teacher,
      });
    } catch (error) {
      console.error('加载样本配置失败:', error);
    }
  }, [projectId]);

  // 初始加载
  useEffect(() => {
    loadSamples();
    loadSampleConfig();
  }, [loadSamples, loadSampleConfig]);

  // 切换区县展开
  const toggleDistrictExpand = useCallback((districtId: string) => {
    setExpandedDistricts(prev =>
      prev.includes(districtId)
        ? prev.filter(id => id !== districtId)
        : [...prev, districtId]
    );
  }, []);

  // 保存样本数据对象配置
  const saveSampleConfig = useCallback(async () => {
    if (!projectId) return;

    try {
      await sampleService.updateSampleConfig(projectId, sampleDataConfig);
      message.success('配置保存成功');
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    }
  }, [projectId, sampleDataConfig]);

  // 添加样本（区/学校）
  const addSample = useCallback(async (values: SampleFormValues, parentId?: string) => {
    if (!projectId) return;

    try {
      if (values.type === 'district') {
        await sampleService.addDistrictSample(projectId, { name: values.name });
      } else {
        // 如果没有指定父级，则添加到第一个区县
        const targetParentId = parentId || (samples.length > 0 ? samples[0].id : undefined);
        if (!targetParentId) {
          message.error('请先添加区县');
          return;
        }
        await sampleService.addSchoolSample(projectId, {
          parentId: targetParentId,
          name: values.name,
          teacherSampleMode: 'self',
        });
      }

      message.success('添加成功');
      loadSamples();
    } catch (error) {
      console.error('添加样本失败:', error);
      message.error('添加样本失败');
    }
  }, [projectId, samples, loadSamples]);

  // 添加教师样本
  const addTeacher = useCallback(async (schoolId: string, values: TeacherFormValues) => {
    if (!projectId) return;

    try {
      await sampleService.addTeacherSample(projectId, {
        parentId: schoolId,
        name: values.name,
        phone: values.phone || '',
        idCard: values.idCard || '',
      });

      message.success('添加成功');
      loadSamples();
    } catch (error) {
      console.error('添加教师失败:', error);
      message.error('添加教师失败');
    }
  }, [projectId, loadSamples]);

  // 删除样本
  const deleteSample = useCallback((type: 'district' | 'school', id: string) => {
    if (!projectId) return;

    Modal.confirm({
      title: '确认删除',
      content: type === 'district'
        ? '删除区县将同时删除其下所有学校和教师，确定要删除吗？'
        : '删除学校将同时删除其下所有教师，确定要删除吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await sampleService.deleteSample(projectId, id);
          message.success('删除成功');
          loadSamples();
        } catch (error) {
          console.error('删除样本失败:', error);
          message.error('删除样本失败');
        }
      },
    });
  }, [projectId, loadSamples]);

  // 删除教师样本
  const deleteTeacher = useCallback(async (schoolId: string, teacherId: string) => {
    if (!projectId) return;

    try {
      await sampleService.deleteSample(projectId, teacherId);
      loadSamples();
    } catch (error) {
      console.error('删除教师失败:', error);
      message.error('删除教师失败');
    }
  }, [projectId, loadSamples]);

  // 更新学校的教师样本模式
  const updateTeacherMode = useCallback(async (schoolId: string, mode: 'self' | 'assigned') => {
    if (!projectId) return;

    try {
      await sampleService.updateSample(projectId, schoolId, { teacherSampleMode: mode });

      // 本地更新状态
      setSamples(prev => prev.map(district => ({
        ...district,
        schools: district.schools.map(school =>
          school.id === schoolId
            ? { ...school, teacherSampleMode: mode }
            : school
        ),
      })));
    } catch (error) {
      console.error('更新教师样本模式失败:', error);
      message.error('更新失败');
    }
  }, [projectId]);

  // 根据ID获取学校
  const getSchoolById = useCallback((schoolId: string) => {
    return samples.flatMap(d => d.schools).find(s => s.id === schoolId);
  }, [samples]);

  return {
    samples,
    sampleDataConfig,
    setSampleDataConfig,
    expandedDistricts,
    toggleDistrictExpand,
    saveSampleConfig,
    addSample,
    addTeacher,
    deleteSample,
    deleteTeacher,
    updateTeacherMode,
    getSchoolById,
    loading,
    loadSamples,
  };
}
