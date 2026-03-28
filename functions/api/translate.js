// functions/api/translate.js
export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { text, target_lang, source_lang = 'en' } = await request.json();
    
    if (!text || !target_lang) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 目标语言是英文，不需要翻译
    if (target_lang === 'en') {
      return new Response(JSON.stringify({ translated_text: text }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 检查 AI 绑定
    if (!env.AI) {
      console.error('AI binding not found');
      return new Response(JSON.stringify({ 
        error: 'AI service not configured',
        translated_text: text
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 调用 Cloudflare AI 翻译模型
    // 使用 m2m100 多语言翻译模型，支持 100+ 种语言
    const response = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: text,
      source_lang: source_lang,
      target_lang: target_lang,
    });
    
    return new Response(JSON.stringify({ 
      translated_text: response.translated_text || text
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Translation error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      translated_text: text || ''
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
