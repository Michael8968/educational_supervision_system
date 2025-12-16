import React, { useState } from "react";
import { Tabs } from "antd";
import SchoolManagement from "./school";
import AccountManagement from "./account";
import styles from "./index.module.less";
import { PageContainer } from "@/component/page-container";
import PageBreadcrumb from "@/component/page-breadcrumb";

const { TabPane } = Tabs;

const SchoolAccountManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState("school");

  const handleTabChange = (key: string) => {
    setActiveTab(key);
  };

  return (
    <PageContainer
      header={<PageBreadcrumb items={[{ title: "学校&账号管理" }]} />}
    >
      <div className={styles.tabContainer}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          className={styles.mainTabs}
        >
          <TabPane
            tab="学校管理"
            key="school"
            className={styles.tabPane}
          ></TabPane>
          <TabPane
            tab="账号管理"
            key="account"
            className={styles.tabPane}
          ></TabPane>
        </Tabs>
      </div>
      <div className={styles.tabContent}>
        {activeTab === "school" ? <SchoolManagement /> : <AccountManagement />}
      </div>
    </PageContainer>
  );
};

export default SchoolAccountManagement;
