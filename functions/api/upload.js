// functions/api/upload.js
// 图片上传到 R2

export async function onRequest(context) {
  const { request, env } = context;
  
  // 检查登录（简单验证）
  const cookies = request.headers.get('Cookie') || '';
  if (!cookies.includes('zhamit_admin=1')) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      return Response.json({ error: 'File must be an image' }, { status: 400 });
    }
    
    // 限制 10MB
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }
    
    // 生成唯一文件名
    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const filename = `${timestamp}.${ext}`;
    const key = `uploads/${filename}`;
    
    // 上传到 R2
    const bytes = await file.arrayBuffer();
    await env.ASSETS.put(key, bytes, {
      httpMetadata: { contentType: file.type }
    });
    
    // 返回图片 URL
    const imageUrl = `/${key}`;
    
    return Response.json({
      success: true,
      url: imageUrl,
      filename: filename
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
