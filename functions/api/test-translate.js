export async function onRequest(context) {
  const { env } = context;
  
  if (!env.AI) {
    return new Response(JSON.stringify({ error: 'AI binding not found' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const response = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: "Hello, this is a test message.",
      target_lang: "zh",
    });
    
    return new Response(JSON.stringify({
      original: "Hello, this is a test message.",
      translated: response.translated_text,
      success: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
