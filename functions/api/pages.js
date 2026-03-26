// functions/api/pages.js
export async function onRequest(context) {
  const { request, env } = context;
  
  // 检查登录状态
  const cookies = request.headers.get('Cookie') || '';
  const isLoggedIn = cookies.includes('zhamit_admin=1');
  
  const url = new URL(request.url);
  const method = request.method;
  
  // GET 请求 - 获取页面列表
  if (method === 'GET') {
    try {
      const stmt = env.DB.prepare('SELECT id, path, title_en, status FROM pages ORDER BY created_at DESC');
      const rows = await stmt.all();
      return Response.json(rows.results || []);
    } catch (err) {
      console.error('GET pages error:', err);
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
  
  // POST 请求 - 创建或更新页面（需要登录）
  if (method === 'POST') {
    if (!isLoggedIn) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    try {
      const data = await request.json();
      const now = new Date().toISOString();
      
      if (data.id) {
        // 更新
        await env.DB.prepare(
          'UPDATE pages SET path = ?, title_en = ?, content = ?, status = ?, updated_at = ? WHERE id = ?'
        ).bind(data.path, data.title_en || '', data.content || '', data.status || 1, now, data.id).run();
      } else {
        // 新增
        await env.DB.prepare(
          'INSERT INTO pages (path, title_en, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(data.path, data.title_en || '', data.content || '', data.status || 1, now, now).run();
      }
      
      return Response.json({ success: true });
    } catch (err) {
      console.error('POST pages error:', err);
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
  
  // DELETE 请求 - 删除页面
  if (method === 'DELETE') {
    if (!isLoggedIn) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    try {
      const { id } = await request.json();
      await env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(id).run();
      return Response.json({ success: true });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
  
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
