// functions/api/media.js - 完整稳定版
export async function onRequest(context) {
  const { request, env } = context;
  
  // 检查登录（暂时注释，先测试上传）
  // const cookies = request.headers.get('Cookie') || '';
  // const isLoggedIn = cookies.includes('zhamit_admin=1');
  // if (!isLoggedIn) {
  //   return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  // }
  
  const url = new URL(request.url);
  const method = request.method;
  
  // GET - 获取图片列表
  if (method === 'GET') {
    try {
      const rows = await env.DB.prepare('SELECT * FROM media ORDER BY created_at DESC').all();
      return Response.json(rows.results || []);
    } catch (err) {
      console.error('GET error:', err);
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
  
  // POST - 上传图片
  if (method === 'POST') {
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      
      if (!file) {
        return Response.json({ error: 'No file uploaded' }, { status: 400 });
      }
      
      // 检查 R2 绑定
      if (!env.ASSETS) {
        return Response.json({ error: 'Storage not configured' }, { status: 500 });
      }
      
      const timestamp = Date.now();
      const originalName = file.name;
      const ext = originalName.split('.').pop();
      const filename = `${timestamp}.${ext}`;
      const key = `media/${filename}`;
      
      const bytes = await file.arrayBuffer();
      
      // 上传到 R2
      await env.ASSETS.put(key, bytes, {
        httpMetadata: { contentType: file.type }
      });
      
      const fileUrl = `/${key}`;
      
      // 保存到数据库
      const now = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO media (filename, original_name, url, size, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(filename, originalName, fileUrl, file.size, file.type, now).run();
      
      return Response.json({ 
        success: true, 
        url: fileUrl,
        filename: filename,
        original_name: originalName
      });
      
    } catch (err) {
      console.error('Upload error:', err);
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
  
  // DELETE - 删除图片
  if (method === 'DELETE') {
    try {
      const { id, filename } = await request.json();
      
      if (env.ASSETS) {
        await env.ASSETS.delete(`media/${filename}`);
      }
      
      await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
      
      return Response.json({ success: true });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
  
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
