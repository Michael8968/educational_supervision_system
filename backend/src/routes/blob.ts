import { Router, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { del } from '@vercel/blob';

export const router = Router();

function toHeaders(input: ExpressRequest['headers']): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(','));
  }
  return headers;
}

/**
 * 兼容 @vercel/blob/client 的 handleUpload：将 Express 请求转换为 WHATWG Request
 * 前端可用 uploadToBlob(..., { handleUploadUrl: 'http://localhost:3001/api/blob/upload' })
 */
router.post('/blob/upload', async (req: ExpressRequest, res: ExpressResponse) => {
  const body = req.body as HandleUploadBody;

  try {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const request = new Request(url, {
      method: 'POST',
      headers: toHeaders(req.headers),
      body: JSON.stringify(body),
    });

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'text/plain',
            'text/csv',
          ],
          maximumSizeInBytes: 20 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // 注意：该回调在 Vercel 侧上传完成后触发；本地开发通常不会触发
        console.log('blob upload completed', blob, tokenPayload);
      },
    });

    res.json(jsonResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
});

router.post('/blob/delete', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const body = (req.body || {}) as { url?: string; pathname?: string };
    const url = typeof body?.url === 'string' ? body.url : undefined;
    const pathname = typeof body?.pathname === 'string' ? body.pathname : undefined;

    if (!url && !pathname) {
      res.status(400).json({ error: '缺少 url 或 pathname' });
      return;
    }

    await del(url || pathname!);
    res.json({ code: 0 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message || '删除失败' });
  }
});


