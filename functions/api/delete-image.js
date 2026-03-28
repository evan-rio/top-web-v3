// functions/api/delete-image.js
// 删除图片

export async function onRequest(context) {
  const { request, env } = context;
  
  const cookies = request.headers.get('Cookie') || '';
  if (!cookies.includes('zhamit_admin=1')) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  try {
    const { key } = await request.json();
    if (!key) {
      return Response.json({ error: 'Missing key' }, { status: 400 });
    }
    
    await env.ASSETS.delete(key);
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
