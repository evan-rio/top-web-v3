// functions/api/media.js - 完整错误捕获版
export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;
    
    // GET 请求 - 获取图片列表
    if (method === 'GET') {
      // 先测试数据库连接
      const test = await env.DB.prepare('SELECT 1 as test').first();
      console.log('DB test:', test);
      
      const rows = await env.DB.prepare('SELECT * FROM media ORDER BY created_at DESC').all();
      return Response.json(rows.results || []);
    }
    
    // POST 请求 - 上传图片
    if (method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');
      
      if (!file) {
        return Response.json({ error: 'No file uploaded' }, { status: 400 });
      }
      
      if (!env.ASSETS) {
        return Response.json({ error: 'ASSETS binding not found' }, { status: 500 });
      }
      
      const timestamp = Date.now();
      const originalName = file.name;
      const ext = originalName.split('.').pop();
      const filename = `${timestamp}.${ext}`;
      const key = `media/${filename}`;
      
      const bytes = await file.arrayBuffer();
      await env.ASSETS.put(key, bytes, {
        httpMetadata: { contentType: file.type }
      });
      
      const fileUrl = `/${key}`;
      const now = new Date().toISOString();
      
      await env.DB.prepare(
        'INSERT INTO media (filename, original_name, url, size, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(filename, originalName, fileUrl, file.size, file.type, now).run();
      
      return Response.json({ success: true, url: fileUrl });
    }
    
    // DELETE 请求 - 删除图片
    if (method === 'DELETE') {
      const { id, filename } = await request.json();
      
      if (env.ASSETS) {
        await env.ASSETS.delete(`media/${filename}`);
      }
      
      await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
      
      return Response.json({ success: true });
    }
    
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
    
  } catch (err) {
    // 捕获所有错误并返回详细信息
    console.error('Media API error:', err);
    return Response.json({ 
      error: err.message,
      stack: err.stack,
      name: err.name
    }, { status: 500 });
  }
}
