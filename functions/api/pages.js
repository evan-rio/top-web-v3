export async function onRequest(context) {
  const { request, env } = context;
  const cookies = request.headers.get('Cookie') || '';
  const isLoggedIn = cookies.includes('zhamit_admin=1');
  
  // GET 请求 - 获取页面列表或单个页面
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (id) {
      const stmt = env.DB.prepare('SELECT * FROM pages WHERE id = ?');
      const page = await stmt.bind(parseInt(id)).first();
      return Response.json(page);
    } else {
      const stmt = env.DB.prepare('SELECT id, path, title_en, status FROM pages ORDER BY created_at DESC');
      const rows = await stmt.all();
      return Response.json(rows.results);
    }
  }
  
  // POST 请求 - 创建或更新页面（需要登录）
  if (request.method === 'POST') {
    if (!isLoggedIn) {
      return new Response('Unauthorized', { status: 401 });
    }
    const data = await request.json();
    const now = new Date().toISOString();
    
    if (data.id) {
      await env.DB.prepare(
        'UPDATE pages SET path = ?, title_en = ?, content = ?, status = ?, updated_at = ? WHERE id = ?'
      ).bind(data.path, data.title_en || '', data.content || '', data.status || 1, now, data.id).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO pages (path, title_en, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(data.path, data.title_en || '', data.content || '', data.status || 1, now, now).run();
    }
    return Response.json({ success: true });
  }
  
  // DELETE 请求 - 删除页面
  if (request.method === 'DELETE') {
    if (!isLoggedIn) {
      return new Response('Unauthorized', { status: 401 });
    }
    const data = await request.json();
    await env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(data.id).run();
    return Response.json({ success: true });
  }
  
  return new Response('Method Not Allowed', { status: 405 });
}
