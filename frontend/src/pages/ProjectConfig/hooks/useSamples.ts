/**
 * 样本管理 Hook
 */

import { useState, useCallback } from 'react';
import { message, Modal } from 'antd';
import type { DistrictSample, SchoolSample, TeacherSample, SampleDataConfig, SampleFormValues, TeacherFormValues } from '../types';

// Mock 样本数据
const mockSamples: DistrictSample[] = [
  {
    id: 'd1',
    name: '和平区',
    type: 'district',
    schools: [
      {
        id: 's1',
        name: '沈阳市第一中学',
        type: 'school',
        teacherSampleMode: 'self',
        teachers: [],
      },
      {
        id: 's2',
        name: '沈阳市实验学校',
        type: 'school',
        teacherSampleMode: 'assigned',
        teachers: [
          { id: 't1', name: '张老师', phone: '13800138001' },
          { id: 't2', name: '李老师', phone: '13800138002' },
        ],
      },
    ],
  },
  {
    id: 'd2',
    name: '沈河区',
    type: 'district',
    schools: [
      {
        id: 's3',
        name: '沈河区第一小学',
        type: 'school',
        teacherSampleMode: 'self',
        teachers: [],
      },
    ],
  },
];

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

export function useSamples() {
  const [samples, setSamples] = useState<DistrictSample[]>(mockSamples);
  const [sampleDataConfig, setSampleDataConfig] = useState<SampleDataConfig>(defaultSampleDataConfig);
  const [expandedDistricts, setExpandedDistricts] = useState<string[]>(['d1']);

  // 切换区县展开
  const toggleDistrictExpand = useCallback((districtId: string) => {
    setExpandedDistricts(prev =>
      prev.includes(districtId)
        ? prev.filter(id => id !== districtId)
        : [...prev, districtId]
    );
  }, []);

  // 保存样本数据对象配置
  const saveSampleConfig = useCallback(() => {
    message.success('配置保存成功');
  }, []);

  // 添加样本（区/学校）
  const addSample = useCallback((values: SampleFormValues) => {
    if (values.type === 'district') {
      const newDistrict: DistrictSample = {
        id: `d-${Date.now()}`,
        name: values.name,
        type: 'district',
        schools: [],
      };
      setSamples(prev => [...prev, newDistrict]);
    } else {
      // 添加到第一个区
      if (samples.length > 0) {
        const newSchool: SchoolSample = {
          id: `s-${Date.now()}`,
          name: values.name,
          type: 'school',
          teacherSampleMode: 'self',
          teachers: [],
        };
        setSamples(prev => prev.map((d, idx) =>
          idx === 0 ? { ...d, schools: [...d.schools, newSchool] } : d
        ));
      }
    }
    message.success('添加成功');
  }, [samples.length]);

  // 添加教师样本
  const addTeacher = useCallback((schoolId: string, values: TeacherFormValues) => {
    const newTeacher: TeacherSample = {
      id: `t-${Date.now()}`,
      name: values.name,
      phone: values.phone || '',
    };

    setSamples(prev => prev.map(district => ({
      ...district,
      schools: district.schools.map(school =>
        school.id === schoolId
          ? { ...school, teachers: [...school.teachers, newTeacher] }
          : school
      ),
    })));

    message.success('添加成功');
  }, []);

  // 删除样本
  const deleteSample = useCallback((type: 'district' | 'school', id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此样本吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        if (type === 'district') {
          setSamples(prev => prev.filter(d => d.id !== id));
        } else {
          setSamples(prev => prev.map(d => ({
            ...d,
            schools: d.schools.filter(s => s.id !== id),
          })));
        }
        message.success('删除成功');
      },
    });
  }, []);

  // 删除教师样本
  const deleteTeacher = useCallback((schoolId: string, teacherId: string) => {
    setSamples(prev => prev.map(district => ({
      ...district,
      schools: district.schools.map(school =>
        school.id === schoolId
          ? { ...school, teachers: school.teachers.filter(t => t.id !== teacherId) }
          : school
      ),
    })));
  }, []);

  // 更新学校的教师样本模式
  const updateTeacherMode = useCallback((schoolId: string, mode: 'self' | 'assigned') => {
    setSamples(prev => prev.map(district => ({
      ...district,
      schools: district.schools.map(school =>
        school.id === schoolId
          ? { ...school, teacherSampleMode: mode }
          : school
      ),
    })));
  }, []);

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
  };
}
