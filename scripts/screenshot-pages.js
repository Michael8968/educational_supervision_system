/**
 * 教育督导系统 - 页面自动截图脚本
 *
 * 使用方法:
 * 1. 确保前端服务已启动: cd frontend && npm run dev
 * 2. 运行脚本: node scripts/screenshot-pages.js
 * 3. 仅截对话框: node scripts/screenshot-pages.js --dialogs-only
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
    { path: '/users/school-account', name: '01-学校账号管理', waitFor: 'body' },
    { path: '/users/expert-account', name: '02-专家账号管理', waitFor: 'body' },
    { path: '/home/balanced/elements', name: '03-要素库', waitFor: 'body' },
    { path: '/home/balanced/indicators', name: '04-指标体系库', waitFor: 'body' },
    { path: '/home/balanced/tools', name: '05-工具库', waitFor: 'body' },
    { path: '/home/balanced', name: '06-项目列表-义务教育', waitFor: 'body' },
  ],
  project_admin: [
    { path: '/home', name: '01-系统首页', waitFor: 'body' },
    { path: '/data-review', name: '02-数据审核', waitFor: 'body' },
  ],
  data_collector: [
    { path: '/collector', name: '01-采集员工作台', waitFor: 'body' },
    { path: '/home/balanced/entry', name: '02-数据填报首页', waitFor: 'body' },
    { path: '/rectification', name: '03-问题整改', waitFor: 'body' },
    // 注意: 表单填报页面 (/home/balanced/entry/:projectId/form/:formId) 需要具体的项目和表单ID
    // 可以通过从采集员工作台点击任务进入，或从数据填报首页选择项目和工具进入
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

// 辅助函数：根据文字查找并点击按钮
async function findAndClickButton(page, keywords, delay_ms = 800) {
  // 等待页面稳定
  await delay(2000);

  // 先尝试所有按钮
  const buttons = await page.$$('.ant-btn');
  console.log(`    找到 ${buttons.length} 个按钮`);

  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent?.trim() || '');
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        console.log(`    点击按钮: "${text}"`);
        // 滚动到按钮位置
        await btn.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
        await delay(300);
        // 使用多种点击方式尝试
        try {
          // 方式1: 使用evaluate直接触发click事件
          await btn.evaluate(el => el.click());
          await delay(delay_ms);
          return true;
        } catch (e) {
          console.log(`    evaluate click失败: ${e.message}`);
          // 方式2: 使用puppeteer原生click
          await btn.click();
          await delay(delay_ms);
          return true;
        }
      }
    }
  }

  // 尝试 ant-btn-primary 按钮
  const primaryButtons = await page.$$('.ant-btn-primary');
  console.log(`    找到 ${primaryButtons.length} 个主要按钮`);

  for (const btn of primaryButtons) {
    const text = await btn.evaluate(el => el.textContent?.trim() || '');
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        console.log(`    点击主要按钮: "${text}"`);
        await btn.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
        await delay(300);
        await btn.evaluate(el => el.click());
        await delay(delay_ms);
        return true;
      }
    }
  }

  console.log(`    未找到包含 [${keywords.join(', ')}] 的按钮`);
  return false;
}

// 辅助函数：点击表格中的操作按钮（需要先有数据）
async function findAndClickTableActionButton(page, buttonText) {
  await delay(1500);

  // 等待表格加载
  const tableExists = await page.$('.ant-table');
  if (!tableExists) {
    console.log('    表格未找到');
    return false;
  }

  // 查找表格行中的操作按钮
  const actionButtons = await page.$$('.ant-table-tbody .ant-btn, .ant-table-tbody a');
  console.log(`    找到 ${actionButtons.length} 个表格操作按钮`);

  for (const btn of actionButtons) {
    const text = await btn.evaluate(el => el.textContent?.trim() || '');
    if (text.includes(buttonText)) {
      console.log(`    点击表格操作按钮: "${text}"`);
      await btn.click();
      await delay(800);
      return true;
    }
  }

  console.log(`    未找到表格操作按钮: ${buttonText}`);
  return false;
}

// 对话框配置 - 需要特殊处理
// 注意：大部分创建功能需要 canManageSystem 权限（仅admin）
const DIALOGS = [
  // ========== 专家账号管理页对话框 ==========
  {
    name: '01-新增专家弹窗',
    role: 'admin',
    navigateTo: '/users/expert-account',
    action: async (page) => {
      return await findAndClickButton(page, ['新增专家']);
    }
  },

  // ========== 项目列表页对话框 ==========
  {
    name: '02-创建项目弹窗',
    role: 'admin',
    navigateTo: '/home/balanced',
    action: async (page) => {
      return await findAndClickButton(page, ['创建项目']);
    }
  },

  // ========== 要素库页对话框 ==========
  {
    name: '03-新建要素库弹窗',
    role: 'admin',
    navigateTo: '/home/balanced/elements',
    action: async (page) => {
      return await findAndClickButton(page, ['新建要素库']);
    }
  },

  // ========== 指标体系库页对话框 ==========
  {
    name: '04-创建评估指标体系弹窗',
    role: 'admin',
    navigateTo: '/home/balanced/indicators',
    action: async (page) => {
      return await findAndClickButton(page, ['创建评估指标体系']);
    }
  },

  // ========== 工具库页对话框 ==========
  {
    name: '05-创建数据采集工具弹窗',
    role: 'admin',
    navigateTo: '/home/balanced/tools',
    action: async (page) => {
      return await findAndClickButton(page, ['创建数据采集工具']);
    }
  },

  // ========== 数据审核页对话框 ==========
  {
    name: '06-数据审核驳回弹窗',
    role: 'project_admin',
    navigateTo: '/data-review',
    action: async (page) => {
      // 驳回按钮在表格行中，需要有待审核的数据
      return await findAndClickTableActionButton(page, '驳回');
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

// 截取对话框截图
async function takeDialogScreenshot(page, filePath) {
  try {
    // 等待对话框出现（增加等待时间）
    await delay(1500); // 先等待一下

    // 检查是否有任何类型的模态框
    const modalSelectors = [
      '.ant-modal',
      '.ant-drawer',
      '.ant-modal-wrap',
      '.ant-modal-root',
      '[role="dialog"]',
      '.ant-modal-mask'
    ];

    let modalFound = false;
    for (const selector of modalSelectors) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        });
        if (isVisible) {
          console.log(`    检测到对话框: ${selector}`);
          modalFound = true;
          break;
        }
      }
    }

    if (!modalFound) {
      // 即使没有检测到对话框，也截取全屏看看发生了什么
      await page.screenshot({ path: filePath });
      console.log(`    已保存(调试): ${path.basename(filePath)}`);
      return true;
    }

    await delay(800); // 等待动画完成

    // 尝试只截取对话框区域
    const modal = await page.$('.ant-modal-content, .ant-drawer-content');
    if (modal) {
      await modal.screenshot({ path: filePath });
      console.log(`    已保存: ${path.basename(filePath)}`);
      return true;
    }

    // 如果无法定位对话框，截取整个页面
    await page.screenshot({ path: filePath });
    console.log(`    已保存(全屏): ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.log(`    对话框截图失败: ${error.message}`);
    // 即使出错也截取一张
    try {
      await page.screenshot({ path: filePath });
      console.log(`    已保存(出错后): ${path.basename(filePath)}`);
    } catch (e) {}
    return false;
  }
}

// 关闭对话框
async function closeDialog(page) {
  try {
    // 尝试点击关闭按钮
    const closeBtn = await page.$('.ant-modal-close, .ant-drawer-close');
    if (closeBtn) {
      await closeBtn.click();
      await delay(500);
      return;
    }

    // 尝试点击取消按钮
    const cancelBtn = await page.$('.ant-modal-footer .ant-btn:not(.ant-btn-primary), .ant-btn:has-text("取消")');
    if (cancelBtn) {
      await cancelBtn.click();
      await delay(500);
      return;
    }

    // 尝试按 ESC 键
    await page.keyboard.press('Escape');
    await delay(500);
  } catch (e) {
    // 忽略关闭失败
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

// 截取对话框
async function screenshotDialogs(browser) {
  console.log('\n========== 对话框截图 ==========');

  const dialogsDir = path.join(SCREENSHOT_DIR, 'dialogs');
  ensureDir(dialogsDir);

  // 按角色分组对话框
  const dialogsByRole = {};
  for (const dialog of DIALOGS) {
    if (!dialogsByRole[dialog.role]) {
      dialogsByRole[dialog.role] = [];
    }
    dialogsByRole[dialog.role].push(dialog);
  }

  // 逐个角色处理
  for (const [role, dialogs] of Object.entries(dialogsByRole)) {
    const account = ACCOUNTS[role];
    if (!account) continue;

    console.log(`\n  角色: ${account.name}`);

    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    // 登录
    const loginSuccess = await login(page, account);
    if (!loginSuccess) {
      console.log('    登录失败，跳过该角色的对话框');
      await page.close();
      continue;
    }

    // 截取该角色的所有对话框
    for (const dialog of dialogs) {
      console.log(`  对话框: ${dialog.name}`);

      try {
        // 导航到目标页面
        await page.goto(`${BASE_URL}${dialog.navigateTo}`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await delay(1000);

        // 执行打开对话框的操作
        const opened = await dialog.action(page);
        if (!opened) {
          console.log('    无法打开对话框，跳过');
          continue;
        }

        // 截图
        const filePath = path.join(dialogsDir, `${dialog.name}.png`);
        await takeDialogScreenshot(page, filePath);

        // 关闭对话框
        await closeDialog(page);

      } catch (error) {
        console.log(`    对话框处理失败: ${error.message}`);
      }
    }

    await page.close();
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const dialogsOnly = args.includes('--dialogs-only');

  console.log('教育督导系统 - 页面自动截图');
  console.log('============================\n');
  console.log(`目标URL: ${BASE_URL}`);
  console.log(`截图目录: ${SCREENSHOT_DIR}`);
  console.log(`分辨率: ${VIEWPORT.width}x${VIEWPORT.height}`);
  if (dialogsOnly) {
    console.log('模式: 仅截取对话框');
  }

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

    if (!dialogsOnly) {
      // 截取公共页面
      await screenshotCommonPages(browser, PAGES_BY_ROLE.common);

      // 按角色截取页面
      for (const [role, pages] of Object.entries(PAGES_BY_ROLE)) {
        if (role === 'common') continue;

        const account = ACCOUNTS[role];
        if (!account) continue;

        await screenshotRolePages(browser, role, pages, account);
      }
    }

    // 截取对话框
    await screenshotDialogs(browser);

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
