// functions/api/media.js
export async function onRequest(context) {
  const { request, env } = context;
  
  // 检查登录状态
  const cookies = request.headers.get('Cookie') || '';
  const isLoggedIn = cookies.includes('zhamit_admin=1');
  if (!isLoggedIn) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const url = new URL(request.url);
  const method = request.method;
  
  // GET 请求 - 获取图片列表
  if (method === 'GET') {
    const stmt = env.DB.prepare('SELECT * FROM media ORDER BY created_at DESC');
    const rows = await stmt.all();
    return Response.json(rows.results);
  }
  
  // POST 请求 - 上传图片
  if (method === 'POST') {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response('No file uploaded', { status: 400 });
    }
    
    // 生成唯一文件名
    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const filename = `${timestamp}.${ext}`;
    const key = `media/${filename}`;
    
    // 读取文件内容
    const bytes = await file.arrayBuffer();
    
    // 上传到 R2
    await env.ASSETS.put(key, bytes, {
      httpMetadata: { contentType: file.type }
    });
    
    // 生成访问 URL
    const url = `/${key}`;
    
    // 记录到数据库
    const now = new Date().toISOString();
    const stmt = env.DB.prepare(
      'INSERT INTO media (filename, original_name, url, size, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    await stmt.bind(filename, file.name, url, file.size, file.type, now).run();
    
    return Response.json({ 
      success: true, 
      url: url,
      filename: filename,
      original_name: file.name
    });
  }
  
  // DELETE 请求 - 删除图片
  if (method === 'DELETE') {
    const { id, filename } = await request.json();
    
    // 从 R2 删除
    await env.ASSETS.delete(`media/${filename}`);
    
    // 从数据库删除
    await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
    
    return Response.json({ success: true });
  }
  
  return new Response('Method Not Allowed', { status: 405 });
}
