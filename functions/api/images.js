// functions/api/images.js
// 获取图片列表

export async function onRequest(context) {
  const { request, env } = context;
  
  const cookies = request.headers.get('Cookie') || '';
  if (!cookies.includes('zhamit_admin=1')) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  try {
    // 列出 R2 中的图片
    const objects = await env.ASSETS.list({ prefix: 'uploads/' });
    const images = objects.objects.map(obj => ({
      key: obj.key,
      url: `/${obj.key}`,
      size: obj.size,
      uploaded: obj.uploaded
    }));
    
    return Response.json(images);
  } catch (error) {
    console.error('List error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
