// functions/index.js
// 处理所有前台页面请求，AI 翻译

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 关键：跳过 API 路由，让它们被 functions/api/*.js 处理
  if (path.startsWith('/api/')) {
    return context.next();
  }
  
  // 跳过静态资源
  if (path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|webp)$/)) {
    return context.next();
  }
  
  // 获取目标语言
  let targetLang = url.searchParams.get('lang');
  if (!targetLang) {
    const cookieMatch = request.headers.get('Cookie')?.match(/lang=([^;]+)/);
    if (cookieMatch) targetLang = cookieMatch[1];
  }
  if (!targetLang) {
    const acceptLang = request.headers.get('Accept-Language') || '';
    targetLang = acceptLang.split(',')[0].split('-')[0] || 'en';
  }
  
  // 从数据库获取内容
  const settings = await getSettings(env);
  const navData = await getNavData(env);
  const page = await getPage(env, path);
  
  // 生成 HTML
  const html = renderHTML(settings, navData, page, targetLang);
  
  // 如果需要翻译且不是中文
  if (targetLang !== 'zh' && targetLang !== 'cn') {
    return translatePage(html, targetLang, env);
  }
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

async function getSettings(env) {
  try {
    const stmt = env.DB.prepare('SELECT * FROM site_settings');
    const rows = await stmt.all();
    const settings = {
      name: '哲觅贸易',
      description: '专业家居贸易公司 · 源自中国义乌'
    };
    for (const row of rows.results) {
      settings[row.key] = row.value_zh || row.value;
    }
    return settings;
  } catch (e) {
    return { name: '哲觅贸易', description: '专业家居贸易公司 · 源自中国义乌' };
  }
}

async function getNavData(env) {
  try {
    const stmt = env.DB.prepare('SELECT * FROM nav_menus WHERE status = 1 ORDER BY location, parent_id, sort_order');
    const rows = await stmt.all();
    return rows.results.map(item => ({
      ...item,
      name: item.name_zh || item.name
    }));
  } catch (e) {
    return [];
  }
}

async function getPage(env, path) {
  try {
    const stmt = env.DB.prepare('SELECT * FROM pages WHERE path = ? AND status = 1 LIMIT 1');
    const page = await stmt.bind(path).first();
    if (!page) return null;
    return {
      title: page.title_zh || page.title,
      content: page.content_zh || page.content
    };
  } catch (e) {
    return null;
  }
}

function renderHTML(settings, navData, page, lang) {
  // 导航菜单
  const topNav = navData.filter(i => i.location === 'top');
  const topParents = topNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  const topHtml = topParents.map(parent => {
    const children = topNav.filter(i => i.parent_id === parent.id).sort((a,b) => a.sort_order - b.sort_order);
    if (children.length) {
      return `<li><a href="${parent.url}">${escapeHtml(parent.name)}</a><ul class="dropdown">${children.map(c => `<li><a href="${c.url}">${escapeHtml(c.name)}</a></li>`).join('')}</ul></li>`;
    }
    return `<li><a href="${parent.url}">${escapeHtml(parent.name)}</a></li>`;
  }).join('');
  
  const bottomNav = navData.filter(i => i.location === 'bottom');
  const bottomParents = bottomNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  const bottomHtml = bottomParents.map(parent => {
    const children = bottomNav.filter(i => i.parent_id === parent.id).sort((a,b) => a.sort_order - b.sort_order);
    if (children.length) {
      return `<div class="footer-col"><h4>${escapeHtml(parent.name)}</h4>${children.map(c => `<a href="${c.url}">${escapeHtml(c.name)}</a>`).join('')}</div>`;
    }
    return `<div class="footer-col"><h4>${escapeHtml(parent.name)}</h4></div>`;
  }).join('');
  
  const pageTitle = page?.title || settings.name;
  const pageContent = page?.content || '<h1>欢迎</h1><p>欢迎访问我们的网站。</p>';
  
  const langNames = {
    en: 'EN', zh: '中文', es: 'ES', fr: 'FR', de: 'DE', ja: '日', ko: '韩', ar: 'عربي', ru: 'RU', pt: 'PT', it: 'IT'
  };
  const langDisplay = langNames[lang] || lang.toUpperCase();
  
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(pageTitle)} - ${escapeHtml(settings.name)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui; line-height: 1.5; }
        .top-nav { background: #1a1a1a; color: white; padding: 0 20px; }
        .top-nav .container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; height: 70px; flex-wrap: wrap; }
        .nav-menu { display: flex; gap: 30px; list-style: none; }
        .nav-menu a { color: white; text-decoration: none; }
        .dropdown { position: absolute; background: white; color: black; min-width: 150px; display: none; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 4px; }
        .nav-menu > li { position: relative; }
        .nav-menu > li:hover .dropdown { display: block; }
        .dropdown li { list-style: none; }
        .dropdown a { display: block; padding: 8px 16px; color: #333; }
        .toolbar { display: flex; gap: 15px; align-items: center; }
        .lang-selector { position: relative; }
        .lang-btn { background: none; border: none; color: white; cursor: pointer; font-size: 14px; }
        .lang-menu { position: absolute; top: 100%; right: 0; background: white; color: black; display: none; min-width: 100px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .lang-selector:hover .lang-menu { display: block; }
        .lang-menu a { display: block; padding: 8px 16px; color: #333; text-decoration: none; font-size: 13px; }
        .lang-menu a:hover { background: #f5f5f5; }
        .search { cursor: pointer; }
        main { max-width: 1200px; margin: 40px auto; padding: 0 20px; min-height: 50vh; }
        .footer-nav { background: #f5f5f5; padding: 40px 20px; margin-top: 40px; }
        .footer-nav .container { max-width: 1200px; margin: 0 auto; display: flex; gap: 40px; flex-wrap: wrap; }
        .footer-col { flex: 1; min-width: 150px; }
        .footer-col h4 { margin-bottom: 12px; font-size: 16px; }
        .footer-col a { display: block; color: #666; text-decoration: none; margin-bottom: 8px; font-size: 13px; }
        .footer-bottom { text-align: center; padding: 20px; background: #eaeaea; font-size: 12px; }
        @media (max-width: 768px) {
            .top-nav .container { flex-direction: column; height: auto; padding: 10px; gap: 10px; }
            .nav-menu { flex-wrap: wrap; justify-content: center; }
            .toolbar { justify-content: center; }
        }
        img { max-width: 100%; height: auto; }
        .rich-text h1, .rich-text h2, .rich-text h3 { margin: 1em 0 0.5em; }
        .rich-text p { margin-bottom: 1em; }
    </style>
</head>
<body>
    <div class="top-nav">
        <div class="container">
            <div class="logo">${escapeHtml(settings.name)}</div>
            <ul class="nav-menu">${topHtml}</ul>
            <div class="toolbar">
                <div class="lang-selector">
                    <button class="lang-btn">🌐 ${langDisplay}</button>
                    <div class="lang-menu">
                        <a href="?lang=en">English</a>
                        <a href="?lang=zh">中文</a>
                        <a href="?lang=es">Español</a>
                        <a href="?lang=fr">Français</a>
                        <a href="?lang=de">Deutsch</a>
                        <a href="?lang=ja">日本語</a>
                        <a href="?lang=ko">한국어</a>
                        <a href="?lang=ar">العربية</a>
                        <a href="?lang=ru">Русский</a>
                        <a href="?lang=pt">Português</a>
                        <a href="?lang=it">Italiano</a>
                    </div>
                </div>
                <div class="search">🔍</div>
            </div>
        </div>
    </div>
    
    <main class="rich-text">${pageContent}</main>
    
    <div class="footer-nav">
        <div class="container">
            <div class="footer-col">
                <div class="footer-logo">${escapeHtml(settings.name)}</div>
                <p>${escapeHtml(settings.description)}</p>
            </div>
            ${bottomHtml}
        </div>
    </div>
    <div class="footer-bottom">
        © 2025 ${escapeHtml(settings.name)}. 保留所有权利。
    </div>
</body>
</html>`;
}

async function translatePage(html, targetLang, env) {
  if (!env.AI) return html;
  
  // 提取 body 内容
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return html;
  
  const bodyContent = bodyMatch[1];
  const beforeBody = html.substring(0, bodyMatch.index);
  const afterBody = html.substring(bodyMatch.index + bodyMatch[0].length);
  
  // 提取所有文本块
  const texts = [];
  const placeholders = [];
  let temp = bodyContent;
  let idx = 0;
  
  temp = bodyContent.replace(/>([^<]+)</g, (match, text) => {
    const trimmed = text.trim();
    if (trimmed && trimmed.length > 1 && !trimmed.match(/^\d+$/)) {
      const placeholder = `{{T_${idx}}}`;
      texts.push(trimmed);
      placeholders.push({ placeholder, original: trimmed });
      idx++;
      return `>${placeholder}<`;
    }
    return match;
  });
  
  // 批量翻译
  const translated = [];
  for (let i = 0; i < texts.length; i++) {
    try {
      const res = await env.AI.run('@cf/meta/m2m100-1.2b', {
        text: texts[i],
        target_lang: targetLang,
      });
      translated.push(res.translated_text || texts[i]);
    } catch (e) {
      translated.push(texts[i]);
    }
  }
  
  // 替换回
  let result = temp;
  for (let i = 0; i < placeholders.length; i++) {
    result = result.replace(placeholders[i].placeholder, translated[i]);
  }
  
  return beforeBody + '<body>' + result + '</body>' + afterBody;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}
