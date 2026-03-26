// functions/api/nav.js
export async function onRequest(context) {
  const { request, env } = context;
  
  const cookies = request.headers.get('Cookie') || '';
  const isLoggedIn = cookies.includes('zhamit_admin=1');
  const method = request.method;
  
  // GET - 获取所有导航菜单
  if (method === 'GET') {
    try {
      const stmt = env.DB.prepare('SELECT * FROM nav_menus WHERE status = 1 ORDER BY parent_id, sort_order');
      const rows = await stmt.all();
      return Response.json(rows.results || []);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
  
  // POST - 保存导航菜单（需要登录）
  if (method === 'POST') {
    if (!isLoggedIn) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    try {
      const items = await request.json();
      // 删除旧数据
      await env.DB.prepare('DELETE FROM nav_menus').run();
      // 插入新数据
      for (const item of items) {
        const now = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO nav_menus (id, name, url, target, sort_order, status, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          item.id, item.name, item.url || '/', item.target || '_self',
          item.sort_order || 0, 1, item.parent_id || 0, now, now
        ).run();
      }
      return Response.json({ success: true });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
  
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
