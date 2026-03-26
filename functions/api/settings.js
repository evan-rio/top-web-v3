export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 简单的登录验证（从 Cookie 检查）
  const cookies = request.headers.get('Cookie') || '';
  const isLoggedIn = cookies.includes('zhamit_admin=1');
  
  // GET 请求 - 获取设置
  if (request.method === 'GET') {
    const stmt = env.DB.prepare('SELECT key, value FROM site_settings');
    const rows = await stmt.all();
    const settings = {
      logo_type: 'text',
      brand_text: 'ZHAMIT',
      brand_text_font: 'Arial',
      brand_text_size: '24px',
      brand_text_transform: 'none',
      brand_text_position: 'right',
      logo_url: '',
      logo_alt: 'ZHAMIT',
      favicon_url: '/favicon.ico',
      contact_email: '',
      contact_phone: '',
      contact_address: 'Yiwu, China'
    };
    for (const row of rows.results) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch(e) {
        settings[row.key] = row.value;
      }
    }
    return Response.json(settings);
  }
  
  // POST 请求 - 保存设置（需要登录）
  if (request.method === 'POST') {
    if (!isLoggedIn) {
      return new Response('Unauthorized', { status: 401 });
    }
    const data = await request.json();
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(data)) {
      const jsonValue = JSON.stringify(value);
      await env.DB.prepare(
        'INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?'
      ).bind(key, jsonValue, now, jsonValue, now).run();
    }
    return Response.json({ success: true });
  }
  
  return new Response('Method Not Allowed', { status: 405 });
}
