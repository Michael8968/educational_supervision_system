import { del } from '@vercel/blob';

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as { url?: string; pathname?: string };
    const url = typeof body?.url === 'string' ? body.url : undefined;
    const pathname = typeof body?.pathname === 'string' ? body.pathname : undefined;

    if (!url && !pathname) {
      return Response.json({ error: '缺少 url 或 pathname' }, { status: 400 });
    }

    await del(url || pathname!);
    return Response.json({ code: 0 });
  } catch (error) {
    return Response.json({ error: (error as Error).message || '删除失败' }, { status: 500 });
  }
}


