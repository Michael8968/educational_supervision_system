/**
 * 人员管理 Hook
 */

import { useState, useCallback } from 'react';
import { message, Modal } from 'antd';
import type { Personnel, ImportRecord, PersonnelFormValues } from '../types';

// Mock 人员数据
const mockPersonnel: Record<string, Personnel[]> = {
  'system_admin': [
    { id: '1', name: 'AAA', organization: '沈阳市教育局', phone: '', idCard: '', role: 'system_admin' },
  ],
  'project_manager': [
    { id: '2', name: '111', organization: '沈阳市教育局', phone: '13900000111', idCard: '210100********1111', role: 'project_manager' },
    { id: '3', name: '222', organization: '沈阳市教育督导室', phone: '13900000222', idCard: '210100********2222', role: 'project_manager' },
  ],
  'data_collector': [
    { id: '4', name: '333', organization: '和平区教育局', phone: '13900000333', idCard: '210100********3333', role: 'data_collector' },
    { id: '5', name: '444', organization: '沈河区教育局', phone: '13900000444', idCard: '210100********4444', role: 'data_collector' },
  ],
  'expert': [
    { id: '6', name: '555', organization: '东北大学', phone: '13900000555', idCard: '210100********5555', role: 'expert' },
    { id: '7', name: '666', organization: '辽宁大学', phone: '13900000666', idCard: '210100********6666', role: 'expert' },
  ],
};

// Mock 导入数据
const mockImportData: ImportRecord[] = [
  { id: '1', status: 'confirmed', role: '数据采集员', name: '王明', organization: '铁西区教育局', phone: '13900001001', idCard: '210100********1001' },
  { id: '2', status: 'name_conflict', role: '数据采集员', name: '李华', organization: '大东区教育局新址', phone: '13900009002', idCard: '210100********1002' },
  { id: '3', status: 'new', role: '项目管理员', name: '陈新', organization: '沈阳市督导办', phone: '13900009001', idCard: '210100********9001' },
  { id: '4', status: 'id_conflict', role: '数据采集员', name: '张丽丽', organization: '沈北新区教育局', phone: '13900001005', idCard: '210100********1005' },
  { id: '5', status: 'confirmed', role: '评估专家', name: '张教授', organization: '东北大学', phone: '13900002001', idCard: '210100********2001' },
  { id: '6', status: 'phone_conflict', role: '数据采集员', name: '孙小磊', organization: '法库县教育局', phone: '13900001010', idCard: '210100********1010' },
  { id: '7', status: 'name_conflict', role: '项目管理员', name: '111', organization: '沈阳市教育局', phone: '13900001111', idCard: '210100********9999' },
  { id: '8', status: 'name_conflict', role: '评估专家', name: '李教授', organization: '沈阳工业大学', phone: '13900002008', idCard: '210100********2008' },
];

export type ImportFilter = 'all' | 'confirmed' | 'new' | 'conflict';

export function usePersonnel() {
  const [personnel, setPersonnel] = useState<Record<string, Personnel[]>>(mockPersonnel);
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [importData, setImportData] = useState<ImportRecord[]>([]);
  const [importFilter, setImportFilter] = useState<ImportFilter>('all');

  // 添加人员
  const addPerson = useCallback((values: PersonnelFormValues) => {
    const newPerson: Personnel = {
      id: `p-${Date.now()}`,
      name: values.name,
      organization: values.organization,
      phone: values.phone,
      idCard: values.idCard || '',
      role: values.role,
    };

    setPersonnel(prev => ({
      ...prev,
      [values.role]: [...(prev[values.role] || []), newPerson],
    }));

    message.success('添加成功');
  }, []);

  // 删除人员
  const deletePerson = useCallback((person: Personnel) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 "${person.name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setPersonnel(prev => ({
          ...prev,
          [person.role]: prev[person.role]?.filter(p => p.id !== person.id) || [],
        }));
        message.success('删除成功');
      },
    });
  }, []);

  // 加载示例导入数据
  const loadSampleImportData = useCallback(() => {
    setImportData(mockImportData);
  }, []);

  // 确认导入
  const confirmImport = useCallback(() => {
    const importableData = importData.filter(r => r.status === 'confirmed' || r.status === 'new');
    message.success(`成功导入 ${importableData.length} 条记录`);
    setImportData([]);
  }, [importData]);

  // 清空导入数据
  const clearImportData = useCallback(() => {
    setImportData([]);
  }, []);

  // 过滤人员
  const filterPersonnel = useCallback((role: string) => {
    const rolePersonnel = personnel[role] || [];
    if (!personnelSearch) return rolePersonnel;

    return rolePersonnel.filter(p =>
      p.name.includes(personnelSearch) ||
      p.organization.includes(personnelSearch) ||
      p.phone.includes(personnelSearch)
    );
  }, [personnel, personnelSearch]);

  // 过滤导入数据
  const filteredImportData = importData.filter(record => {
    if (importFilter === 'all') return true;
    if (importFilter === 'confirmed') return record.status === 'confirmed';
    if (importFilter === 'new') return record.status === 'new';
    if (importFilter === 'conflict') return ['name_conflict', 'id_conflict', 'phone_conflict'].includes(record.status);
    return true;
  });

  // 统计导入数据
  const importStats = {
    total: importData.length,
    confirmed: importData.filter(r => r.status === 'confirmed').length,
    new: importData.filter(r => r.status === 'new').length,
    conflict: importData.filter(r => ['name_conflict', 'id_conflict', 'phone_conflict'].includes(r.status)).length,
  };

  return {
    personnel,
    personnelSearch,
    setPersonnelSearch,
    importData,
    importFilter,
    setImportFilter,
    filteredImportData,
    importStats,
    addPerson,
    deletePerson,
    loadSampleImportData,
    confirmImport,
    clearImportData,
    filterPersonnel,
  };
}
