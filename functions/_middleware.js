// functions/_middleware.js
// AI 自动翻译中间件 - 翻译整个页面，无需映射表

export async function onRequest(context) {
  const { request, env, next } = context;
  
  // 获取用户语言（从 Cookie 或浏览器语言）
  let targetLang = 'en';
  const cookieMatch = request.headers.get('Cookie')?.match(/lang=([^;]+)/);
  if (cookieMatch) targetLang = cookieMatch[1];
  
  // 如果用户没有设置 Cookie，从浏览器语言检测
  if (!cookieMatch) {
    const acceptLang = request.headers.get('Accept-Language') || '';
    if (acceptLang.includes('zh')) targetLang = 'zh';
    else if (acceptLang.includes('es')) targetLang = 'es';
    else if (acceptLang.includes('ar')) targetLang = 'ar';
    else targetLang = 'en';
  }
  
  // 只翻译 HTML 页面，不翻译 API 和静态资源
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || 
      url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|webp)$/)) {
    return next();
  }
  
  // 获取原始响应
  const response = await next();
  const contentType = response.headers.get('Content-Type') || '';
  
  // 只处理 HTML
  if (!contentType.includes('text/html')) {
    return response;
  }
  
  // 如果目标语言是英文，直接返回原文
  if (targetLang === 'en') {
    return response;
  }
  
  // 获取 HTML 内容
  const html = await response.text();
  
  // 调用 AI 翻译整个 HTML
  const translatedHtml = await translateWithAI(html, targetLang, env);
  
  return new Response(translatedHtml, {
    status: response.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}

// 使用 AI 翻译整个 HTML
async function translateWithAI(html, targetLang, env) {
  if (!env.AI) {
    console.error('AI binding not found');
    return html;
  }
  
  // 提取 HTML 中的纯文本进行翻译（保留标签）
  // 简化：只翻译 body 内的文本内容
  
  // 提取 body 内容
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return html;
  
  const bodyContent = bodyMatch[1];
  const beforeBody = html.substring(0, bodyMatch.index);
  const afterBody = html.substring(bodyMatch.index + bodyMatch[0].length);
  
  // 提取所有文本节点（简化：用正则提取标签外的文本）
  // 这里我们分块翻译，避免单次翻译内容过大
  
  // 获取所有需要翻译的文本块
  const textBlocks = [];
  const textRegex = />([^<]+)</g;
  let match;
  let tempContent = bodyContent;
  const placeholders = [];
  
  // 用占位符替换文本，同时记录
  let index = 0;
  tempContent = bodyContent.replace(/>([^<]+)</g, (match, text) => {
    if (text.trim() && !text.match(/^\s*$/)) {
      const placeholder = `{{TEXT_${index}}}`;
      textBlocks.push(text.trim());
      placeholders.push({ placeholder, original: text.trim() });
      index++;
      return `>${placeholder}<`;
    }
    return match;
  });
  
  // 批量翻译文本块
  const translatedTexts = [];
  for (const block of textBlocks) {
    try {
      const response = await env.AI.run('@cf/meta/m2m100-1.2b', {
        text: block,
        source_lang: 'en',
        target_lang: targetLang,
      });
      translatedTexts.push(response.translated_text || block);
    } catch (e) {
      console.error('翻译失败:', block, e);
      translatedTexts.push(block);
    }
  }
  
  // 替换回翻译后的文本
  let translatedBody = tempContent;
  for (let i = 0; i < placeholders.length; i++) {
    translatedBody = translatedBody.replace(placeholders[i].placeholder, translatedTexts[i]);
  }
  
  return beforeBody + '<body>' + translatedBody + '</body>' + afterBody;
}
