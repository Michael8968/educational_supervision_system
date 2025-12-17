/**
 * Jest 测试配置文件
 */

// 设置测试超时时间
jest.setTimeout(10000);

// 禁用控制台日志（测试时避免干扰输出）
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});
