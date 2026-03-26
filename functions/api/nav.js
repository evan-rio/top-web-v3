export async function onRequest(context) {
  const { request, env } = context;
  const cookies = request.headers.get('Cookie') || '';
  const isLoggedIn = cookies.includes('zhamit_admin=1');
  
  // GET 请求 - 获取导航菜单
  if (request.method === 'GET') {
    const stmt = env.DB.prepare('SELECT * FROM nav_menus WHERE status = 1 ORDER BY parent_id, sort_order');
    const rows = await stmt.all();
    return Response.json(rows.results);
  }
  
  // POST 请求 - 保存导航菜单（需要登录）
  if (request.method === 'POST') {
    if (!isLoggedIn) {
      return new Response('Unauthorized', { status: 401 });
    }
    const items = await request.json();
    await env.DB.prepare('DELETE FROM nav_menus').run();
    for (const item of items) {
      const now = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO nav_menus (id, name, url, target, sort_order, status, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(item.id, item.name, item.url, item.target || '_self', item.sort_order || 0, 1, item.parent_id || 0, now, now).run();
    }
    return Response.json({ success: true });
  }
  
  return new Response('Method Not Allowed', { status: 405 });
}
