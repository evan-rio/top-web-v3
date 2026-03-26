// functions/api/auth/check.js
export async function onRequest(context) {
  const { request } = context;
  const cookies = request.headers.get('Cookie') || '';
  const isLoggedIn = cookies.includes('zhamit_admin=1');
  
  if (isLoggedIn) {
    return new Response('OK', { status: 200 });
  } else {
    return new Response('Unauthorized', { status: 401 });
  }
}
