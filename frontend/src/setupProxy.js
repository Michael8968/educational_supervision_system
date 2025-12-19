const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * CRA 开发代理：
 * - /api/blob/* 走 Vercel Dev（用于 Vercel Blob 的 handleUpload / del）
 *
 * 说明：
 * - `vercel dev` 默认端口常与 CRA(3000) 冲突，建议使用 3002：
 *   `vercel dev --listen 3002`
 */
module.exports = function (app) {
  app.use(
    '/api/blob',
    createProxyMiddleware({
      target: process.env.REACT_APP_VERCEL_DEV_URL || 'http://localhost:3002',
      changeOrigin: true,
    }),
  );
};


