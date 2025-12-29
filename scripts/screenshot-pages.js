/**
 * 教育督导系统 - 页面自动截图脚本
 *
 * 使用方法:
 * 1. 确保前端服务已启动: cd frontend && npm run dev
 * 2. 运行脚本: node scripts/screenshot-pages.js
 *
 * 截图将保存到 docs/screenshots/ 目录
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// 配置
const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, '../docs/screenshots');
const VIEWPORT = { width: 1920, height: 1080 };

// 测试账号配置
const ACCOUNTS = {
  admin: { phone: '13800000000', password: '000000', name: '系统管理员' },
  project_admin: { phone: '13900139003', password: 'Pass@123456', name: '项目管理员' },
  data_collector: { phone: '13700137006', password: 'Pass@123456', name: '数据采集员' },
  project_expert: { phone: '13600136005', password: 'Pass@123456', name: '项目评估专家' },
  decision_maker: { phone: '13500135003', password: 'Pass@123456', name: '报告决策者' },
};

// 页面配置 - 按角色分类 (使用 body 作为通用等待选择器)
const PAGES_BY_ROLE = {
  admin: [
    { path: '/home/system/districts', name: '01-区县管理', waitFor: 'body' },
    { path: '/home/system/schools', name: '02-学校管理', waitFor: 'body' },
    { path: '/users/school-account', name: '03-学校账号管理', waitFor: 'body' },
    { path: '/users/expert-account', name: '04-专家账号管理', waitFor: 'body' },
  ],
  project_admin: [
    { path: '/home', name: '01-系统首页', waitFor: 'body' },
    { path: '/home/balanced', name: '02-项目列表-义务教育', waitFor: 'body' },
    { path: '/home/balanced/elements', name: '03-要素库', waitFor: 'body' },
    { path: '/home/balanced/indicators', name: '04-指标体系库', waitFor: 'body' },
    { path: '/home/balanced/tools', name: '05-工具库', waitFor: 'body' },
    { path: '/data-review', name: '06-数据审核', waitFor: 'body' },
  ],
  data_collector: [
    { path: '/collector', name: '01-采集员工作台', waitFor: 'body' },
    { path: '/rectification', name: '02-问题整改', waitFor: 'body' },
  ],
  project_expert: [
    { path: '/expert', name: '01-专家工作台', waitFor: 'body' },
    { path: '/expert/evaluations', name: '02-评估任务列表', waitFor: 'body' },
    { path: '/expert/pending-reviews', name: '03-待审核列表', waitFor: 'body' },
  ],
  decision_maker: [
    { path: '/reports', name: '01-报告列表', waitFor: 'body' },
    { path: '/reports/statistics', name: '02-统计报告', waitFor: 'body' },
    { path: '/reports/rankings', name: '03-排名报告', waitFor: 'body' },
    { path: '/reports/alerts', name: '04-预警报告', waitFor: 'body' },
    { path: '/reports/comparison', name: '05-对比报告', waitFor: 'body' },
  ],
  common: [
    { path: '/login', name: '01-登录页', waitFor: 'body', noLogin: true },
  ],
};

// 对话框配置 - 需要特殊处理
const DIALOGS = [
  {
    name: '01-添加评估学校弹窗',
    role: 'project_admin',
    navigateTo: '/home/balanced',
    action: async (page) => {
      // 点击第一个项目的配置按钮
      await page.waitForSelector('.ant-card');
      await page.click('.ant-card .ant-btn');
      await page.waitForTimeout(1000);
      // 尝试找到并点击"评估对象"tab，然后点击添加按钮
      try {
        await page.waitForSelector('.ant-tabs-tab', { timeout: 3000 });
        const tabs = await page.$$('.ant-tabs-tab');
        if (tabs.length > 0) {
          await tabs[0].click();
          await page.waitForTimeout(500);
          await page.click('.ant-btn-primary');
          await page.waitForTimeout(500);
        }
      } catch (e) {
        console.log('    跳过对话框截图（页面结构不匹配）');
        return false;
      }
      return true;
    }
  },
];

// 工具函数
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 登出函数 - 清除登录状态
async function logout(page) {
  // 清除 localStorage 和 sessionStorage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  // 清除 cookies
  const client = await page.createCDPSession();
  await client.send('Network.clearBrowserCookies');
}

// 登录函数
async function login(page, account) {
  console.log(`  登录账号: ${account.name} (${account.phone})`);

  // 先访问页面，然后清除登录状态
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await delay(500);

  // 清除之前的登录状态
  await logout(page);

  // 重新加载登录页
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await delay(1000);
  await page.waitForSelector('input[type="text"], input[placeholder*="手机"]', { timeout: 10000 });

  // 清空并输入手机号
  const phoneInput = await page.$('input[type="text"], input[placeholder*="手机"]');
  await phoneInput.click({ clickCount: 3 });
  await phoneInput.type(account.phone);

  // 输入密码
  const passwordInput = await page.$('input[type="password"]');
  await passwordInput.click({ clickCount: 3 });
  await passwordInput.type(account.password);

  // 点击登录按钮
  await page.click('button[type="submit"], .ant-btn-primary');

  // 等待登录成功（跳转或出现特定元素）
  await delay(2000);

  // 检查是否登录成功
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    console.log('    登录可能失败，当前仍在登录页');
    return false;
  }

  console.log('    登录成功');
  return true;
}

// 截图函数
async function takeScreenshot(page, filePath, options = {}) {
  const { waitFor, fullPage = false } = options;

  try {
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 5000 });
    }
    await delay(1000); // 等待动画完成

    await page.screenshot({
      path: filePath,
      fullPage: fullPage,
    });

    console.log(`    已保存: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.log(`    截图失败: ${error.message}`);
    return false;
  }
}

// 截取角色页面
async function screenshotRolePages(browser, role, pages, account) {
  console.log(`\n========== ${account.name} ==========`);

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  const roleDir = path.join(SCREENSHOT_DIR, role);
  ensureDir(roleDir);

  // 登录
  const loginSuccess = await login(page, account);
  if (!loginSuccess) {
    console.log('  登录失败，跳过该角色');
    await page.close();
    return;
  }

  // 截取各页面
  for (const pageConfig of pages) {
    if (pageConfig.noLogin) continue;

    console.log(`  访问: ${pageConfig.path}`);

    try {
      await page.goto(`${BASE_URL}${pageConfig.path}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const filePath = path.join(roleDir, `${pageConfig.name}.png`);
      await takeScreenshot(page, filePath, { waitFor: pageConfig.waitFor });
    } catch (error) {
      console.log(`    访问失败: ${error.message}`);
    }
  }

  await page.close();
}

// 截取公共页面（不需要登录）
async function screenshotCommonPages(browser, pages) {
  console.log('\n========== 公共页面 ==========');

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  const commonDir = path.join(SCREENSHOT_DIR, 'common');
  ensureDir(commonDir);

  for (const pageConfig of pages) {
    console.log(`  访问: ${pageConfig.path}`);

    try {
      await page.goto(`${BASE_URL}${pageConfig.path}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const filePath = path.join(commonDir, `${pageConfig.name}.png`);
      await takeScreenshot(page, filePath, { waitFor: pageConfig.waitFor });
    } catch (error) {
      console.log(`    访问失败: ${error.message}`);
    }
  }

  await page.close();
}

// 主函数
async function main() {
  console.log('教育督导系统 - 页面自动截图');
  console.log('============================\n');
  console.log(`目标URL: ${BASE_URL}`);
  console.log(`截图目录: ${SCREENSHOT_DIR}`);
  console.log(`分辨率: ${VIEWPORT.width}x${VIEWPORT.height}`);

  // 检查前端服务是否运行
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const testPage = await browser.newPage();
    try {
      await testPage.goto(BASE_URL, { timeout: 5000 });
      await testPage.close();
    } catch (e) {
      console.error('\n错误: 无法连接到前端服务');
      console.error('请确保前端服务已启动: cd frontend && npm run dev');
      await browser.close();
      process.exit(1);
    }

    // 截取公共页面
    await screenshotCommonPages(browser, PAGES_BY_ROLE.common);

    // 按角色截取页面
    for (const [role, pages] of Object.entries(PAGES_BY_ROLE)) {
      if (role === 'common') continue;

      const account = ACCOUNTS[role];
      if (!account) continue;

      await screenshotRolePages(browser, role, pages, account);
    }

    console.log('\n============================');
    console.log('截图完成！');
    console.log(`截图保存在: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('截图过程出错:', error);
  } finally {
    await browser.close();
  }
}

// 运行
main().catch(console.error);
