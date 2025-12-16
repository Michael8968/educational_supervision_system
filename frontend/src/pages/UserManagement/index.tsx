import React, { useState } from 'react';
import { Tabs } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import SchoolManagement from './school';
import AccountManagement from './account';
import styles from './index.module.css';

const SchoolAccountManagement: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('school');

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate('/home')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h2 className={styles.pageTitle}>学校&账号管理</h2>
      </div>
      <div className={styles.tabContainer}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          className={styles.mainTabs}
          items={[
            { key: 'school', label: '学校管理' },
            { key: 'account', label: '账号管理' },
          ]}
        />
      </div>
      <div className={styles.tabContent}>
        {activeTab === 'school' ? <SchoolManagement /> : <AccountManagement />}
      </div>
    </div>
  );
};

export default SchoolAccountManagement;


