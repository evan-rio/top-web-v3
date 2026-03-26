// functions/api/settings.js
export async function onRequest(context) {
  const { request, env } = context;
  
  const cookies = request.headers.get('Cookie') || '';
  const isLoggedIn = cookies.includes('zhamit_admin=1');
  const method = request.method;
  
  // GET - 获取所有设置
  if (method === 'GET') {
    try {
      const stmt = env.DB.prepare('SELECT key, value FROM site_settings');
      const rows = await stmt.all();
      
      // 默认设置
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
        contact_email: 'info@zhamit.com',
        contact_phone: '',
        contact_address: 'Yiwu, China'
      };
      
      // 覆盖数据库中的值
      for (const row of rows.results) {
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch(e) {
          settings[row.key] = row.value;
        }
      }
      
      return Response.json(settings);
    } catch (err) {
      console.error('GET settings error:', err);
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
  
  // POST - 保存设置（需要登录）
  if (method === 'POST') {
    if (!isLoggedIn) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    try {
      const data = await request.json();
      const now = new Date().toISOString();
      
      for (const [key, value] of Object.entries(data)) {
        const jsonValue = JSON.stringify(value);
        await env.DB.prepare(
          'INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?'
        ).bind(key, jsonValue, now, jsonValue, now).run();
      }
      
      return Response.json({ success: true });
    } catch (err) {
      console.error('POST settings error:', err);
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
  
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
