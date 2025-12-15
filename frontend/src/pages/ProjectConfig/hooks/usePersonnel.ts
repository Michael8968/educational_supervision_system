/**
 * 人员管理 Hook
 */

import { useState, useCallback, useEffect } from 'react';
import { message, Modal } from 'antd';
import * as personnelService from '../../../services/personnelService';
import type { Personnel, ImportRecord, PersonnelFormValues } from '../types';

export type ImportFilter = 'all' | 'confirmed' | 'new' | 'conflict';

// 角色映射：后端角色 -> 前端角色key
const backendToFrontendRole: Record<string, string> = {
  leader: 'project_manager',
  member: 'data_collector',
  expert: 'expert',
  observer: 'system_admin',
};

// 角色映射：前端角色key -> 后端角色
const frontendToBackendRole: Record<string, string> = {
  system_admin: 'observer',
  project_manager: 'leader',
  data_collector: 'member',
  expert: 'expert',
};

export function usePersonnel(projectId?: string) {
  const [personnel, setPersonnel] = useState<Record<string, Personnel[]>>({});
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [importData, setImportData] = useState<ImportRecord[]>([]);
  const [importFilter, setImportFilter] = useState<ImportFilter>('all');
  const [loading, setLoading] = useState(false);

  // 加载人员数据
  const loadPersonnel = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const data = await personnelService.getPersonnel(projectId);

      // 按角色分组
      const grouped: Record<string, Personnel[]> = {
        system_admin: [],
        project_manager: [],
        data_collector: [],
        expert: [],
      };

      data.forEach(person => {
        const frontendRole = backendToFrontendRole[person.role] || person.role;
        const mappedPerson: Personnel = {
          id: person.id,
          name: person.name,
          organization: person.organization,
          phone: person.phone,
          idCard: person.idCard,
          role: frontendRole,
        };

        if (!grouped[frontendRole]) {
          grouped[frontendRole] = [];
        }
        grouped[frontendRole].push(mappedPerson);
      });

      setPersonnel(grouped);
    } catch (error) {
      console.error('加载人员数据失败:', error);
      message.error('加载人员数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // 初始加载
  useEffect(() => {
    loadPersonnel();
  }, [loadPersonnel]);

  // 添加人员
  const addPerson = useCallback(async (values: PersonnelFormValues) => {
    if (!projectId) {
      message.error('项目ID不存在');
      return;
    }

    try {
      const backendRole = frontendToBackendRole[values.role] || values.role;

      await personnelService.addPersonnel(projectId, {
        name: values.name,
        organization: values.organization,
        phone: values.phone,
        idCard: values.idCard || '',
        role: backendRole as any,
      });

      message.success('添加成功');
      loadPersonnel();
    } catch (error) {
      console.error('添加人员失败:', error);
      message.error('添加人员失败');
    }
  }, [projectId, loadPersonnel]);

  // 删除人员
  const deletePerson = useCallback((person: Personnel) => {
    if (!projectId) return;

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 "${person.name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await personnelService.deletePersonnel(projectId, person.id);
          message.success('删除成功');
          loadPersonnel();
        } catch (error) {
          console.error('删除人员失败:', error);
          message.error('删除人员失败');
        }
      },
    });
  }, [projectId, loadPersonnel]);

  // 加载示例导入数据（模拟文件解析后的预览）
  const loadSampleImportData = useCallback(() => {
    // 这里实际应该是解析上传的文件
    const mockImportData: ImportRecord[] = [
      { id: '1', status: 'confirmed', role: 'data_collector', name: '王明', organization: '铁西区教育局', phone: '13900001001', idCard: '210100********1001' },
      { id: '2', status: 'name_conflict', role: 'data_collector', name: '李华', organization: '大东区教育局新址', phone: '13900009002', idCard: '210100********1002' },
      { id: '3', status: 'new', role: 'project_manager', name: '陈新', organization: '沈阳市督导办', phone: '13900009001', idCard: '210100********9001' },
      { id: '4', status: 'id_conflict', role: 'data_collector', name: '张丽丽', organization: '沈北新区教育局', phone: '13900001005', idCard: '210100********1005' },
      { id: '5', status: 'confirmed', role: 'expert', name: '张教授', organization: '东北大学', phone: '13900002001', idCard: '210100********2001' },
    ];
    setImportData(mockImportData);
  }, []);

  // 确认导入
  const confirmImport = useCallback(async () => {
    if (!projectId) return;

    const importableData = importData.filter(r => r.status === 'confirmed' || r.status === 'new');

    if (importableData.length === 0) {
      message.warning('没有可导入的数据');
      return;
    }

    try {
      const personnelToImport = importableData.map(record => ({
        name: record.name,
        organization: record.organization,
        phone: record.phone,
        idCard: record.idCard,
        role: (frontendToBackendRole[record.role] || record.role) as 'leader' | 'member' | 'expert' | 'observer',
      }));

      const result = await personnelService.importPersonnel(projectId, personnelToImport);
      message.success(`成功导入 ${result.success} 条记录`);

      if (result.failed > 0) {
        message.warning(`${result.failed} 条记录导入失败`);
      }

      setImportData([]);
      loadPersonnel();
    } catch (error) {
      console.error('导入失败:', error);
      message.error('导入失败');
    }
  }, [projectId, importData, loadPersonnel]);

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
    loading,
    loadPersonnel,
  };
}
