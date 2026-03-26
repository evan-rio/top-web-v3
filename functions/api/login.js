export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  
  const data = await request.json();
  const adminPassword = env.ADMIN_PASSWORD || 'zhamit2025';
  
  if (data.password === adminPassword) {
    return new Response('OK', {
      status: 200,
      headers: {
        'Set-Cookie': 'zhamit_admin=1; path=/; max-age=86400; SameSite=Lax',
        'Content-Type': 'text/plain'
      }
    });
  }
  
  return new Response('Unauthorized', { status: 401 });
}
