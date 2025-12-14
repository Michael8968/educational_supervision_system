/**
 * 中间件统一导出
 */

const auth = require('./auth');
const validate = require('./validate');

module.exports = {
  ...auth,
  ...validate
};
