// functions/index.js - 稳定版（无缓存，简化手机端）

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 跳过 API 和静态资源
  if (path.startsWith('/api/') || path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|webp)$/)) {
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
  
  // 获取数据
  let settings = { name: '哲觅贸易', description: '专业家居贸易公司 · 源自中国义乌' };
  let navData = [];
  let page = { title: settings.name, content: '<h1>欢迎</h1><p>欢迎访问我们的网站。</p>' };
  
  try {
    const settingsStmt = env.DB.prepare('SELECT * FROM site_settings');
    const settingsRows = await settingsStmt.all();
    for (const row of settingsRows.results) {
      settings[row.key] = row.value_zh || row.value;
    }
  } catch (e) {}
  
  try {
    const navStmt = env.DB.prepare('SELECT * FROM nav_menus WHERE status = 1 ORDER BY location, parent_id, sort_order');
    const navRows = await navStmt.all();
    navData = navRows.results.map(item => ({
      ...item,
      name: item.name_zh || item.name
    }));
  } catch (e) {}
  
  try {
    const pageStmt = env.DB.prepare('SELECT * FROM pages WHERE path = ? AND status = 1 LIMIT 1');
    const pageResult = await pageStmt.bind(path === '/' ? '/' : path).first();
    if (pageResult) {
      page.title = pageResult.title_zh || pageResult.title;
      page.content = pageResult.content_zh || pageResult.content;
    }
  } catch (e) {}
  
  // 生成顶部导航
  const topNav = navData.filter(i => i.location === 'top');
  const topParents = topNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  let topHtml = '';
  for (const parent of topParents) {
    const children = topNav.filter(i => i.parent_id === parent.id).sort((a,b) => a.sort_order - b.sort_order);
    if (children.length) {
      topHtml += `<li><a href="${parent.url}">${escapeHtml(parent.name)}</a><ul class="dropdown">`;
      for (const child of children) {
        topHtml += `<li><a href="${child.url}">${escapeHtml(child.name)}</a></li>`;
      }
      topHtml += `</ul></li>`;
    } else {
      topHtml += `<li><a href="${parent.url}">${escapeHtml(parent.name)}</a></li>`;
    }
  }
  
  // 生成底部导航
  const bottomNav = navData.filter(i => i.location === 'bottom');
  const bottomParents = bottomNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  let bottomHtml = '';
  for (const parent of bottomParents) {
    const children = bottomNav.filter(i => i.parent_id === parent.id).sort((a,b) => a.sort_order - b.sort_order);
    if (children.length) {
      bottomHtml += `<div class="footer-col"><h4>${escapeHtml(parent.name)}</h4>`;
      for (const child of children) {
        bottomHtml += `<a href="${child.url}">${escapeHtml(child.name)}</a>`;
      }
      bottomHtml += `</div>`;
    } else {
      bottomHtml += `<div class="footer-col"><h4>${escapeHtml(parent.name)}</h4></div>`;
    }
  }
  
  const defaultBottom = `<div class="footer-col"><h4>快速链接</h4><a href="/about">关于我们</a><a href="/contact">联系我们</a></div><div class="footer-col"><h4>联系方式</h4><a href="mailto:info@zhamit.com">info@zhamit.com</a><a href="tel:+8657912345678">+86 579 12345678</a></div>`;
  
  const langNames = {
    en: 'EN', zh: '中文', es: 'ES', fr: 'FR', de: 'DE', ja: '日', ko: '韩', ar: 'عربي', ru: 'RU', pt: 'PT', it: 'IT'
  };
  const langDisplay = langNames[targetLang] || targetLang.toUpperCase();
  
  const html = `<!DOCTYPE html>
<html lang="${targetLang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>${escapeHtml(page.title)} - ${escapeHtml(settings.name)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui; line-height: 1.5; }
        
        @media (min-width: 769px) {
            .top-nav { background: #1a1a1a; color: white; padding: 0 20px; }
            .top-nav .container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; height: 70px; }
            .nav-menu { display: flex; gap: 30px; list-style: none; }
            .nav-menu a { color: white; text-decoration: none; }
            .dropdown { position: absolute; background: white; color: black; min-width: 150px; display: none; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 4px; z-index: 100; }
            .nav-menu > li { position: relative; }
            .nav-menu > li:hover .dropdown { display: block; }
            .dropdown li { list-style: none; }
            .dropdown a { display: block; padding: 8px 16px; color: #333; }
            .toolbar { display: flex; gap: 15px; align-items: center; }
            .lang-selector { position: relative; }
            .lang-btn { background: none; border: none; color: white; cursor: pointer; font-size: 14px; }
            .lang-menu { position: absolute; top: 100%; right: 0; background: white; color: black; display: none; min-width: 100px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 100; }
            .lang-selector:hover .lang-menu { display: block; }
            .lang-menu a { display: block; padding: 8px 16px; color: #333; text-decoration: none; font-size: 13px; }
            .mobile-only { display: none !important; }
        }
        
        @media (max-width: 768px) {
            .desktop-only { display: none !important; }
            .top-nav { background: #1a1a1a; color: white; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; }
            .hamburger { background: none; border: none; width: 28px; height: 28px; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; }
            .hamburger span { display: block; width: 100%; height: 2px; background: white; border-radius: 2px; }
            .mobile-logo { font-size: 18px; font-weight: bold; }
            .mobile-toolbar { display: flex; gap: 12px; }
            .mobile-lang-btn, .mobile-search-btn { background: none; border: none; color: white; font-size: 16px; cursor: pointer; }
            .side-menu { position: fixed; top: 0; left: 0; width: 85%; max-width: 300px; height: 100%; background: white; z-index: 300; transform: translateX(-100%); transition: transform 0.3s; overflow-y: auto; box-shadow: 2px 0 12px rgba(0,0,0,0.1); }
            .side-menu.open { transform: translateX(0); }
            .menu-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            .close-menu { background: none; border: none; font-size: 24px; cursor: pointer; }
            .menu-list { padding: 8px 0; }
            .menu-parent { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; cursor: pointer; border-bottom: 1px solid #f0f0f0; }
            .menu-parent span { font-size: 16px; font-weight: 500; }
            .toggle-sub { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; width: 30px; }
            .submenu { display: none; background: #f9f9f9; padding-left: 20px; }
            .submenu.open { display: block; }
            .submenu a { display: block; padding: 12px 20px; color: #666; text-decoration: none; font-size: 14px; }
            .menu-single { display: block; padding: 14px 20px; color: #333; text-decoration: none; font-size: 16px; border-bottom: 1px solid #f0f0f0; }
        }
        
        main { max-width: 1200px; margin: 40px auto; padding: 0 20px; min-height: 50vh; }
        .footer-nav { background: #f5f5f5; padding: 40px 20px; margin-top: 40px; }
        .footer-nav .container { max-width: 1200px; margin: 0 auto; display: flex; gap: 40px; flex-wrap: wrap; }
        .footer-col { flex: 1; min-width: 150px; }
        .footer-col h4 { margin-bottom: 12px; font-size: 16px; }
        .footer-col a { display: block; color: #666; text-decoration: none; margin-bottom: 8px; font-size: 13px; }
        .footer-bottom { text-align: center; padding: 20px; background: #eaeaea; font-size: 12px; }
        img { max-width: 100%; height: auto; }
        .rich-text h1, .rich-text h2, .rich-text h3 { margin: 1em 0 0.5em; }
        .rich-text p { margin-bottom: 1em; }
    </style>
</head>
<body>
    <div class="desktop-only">
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
    </div>
    
    <div class="mobile-only">
        <div class="top-nav">
            <button class="hamburger" id="hamburgerBtn"><span></span><span></span><span></span></button>
            <div class="mobile-logo">${escapeHtml(settings.name)}</div>
            <div class="mobile-toolbar">
                <button class="mobile-lang-btn" id="mobileLangBtn">🌐 <span id="mobileLangDisplay">${langDisplay}</span></button>
                <button class="mobile-search-btn" id="mobileSearchBtn">🔍</button>
            </div>
        </div>
        
        <div class="side-menu" id="sideMenu">
            <div class="menu-header">
                <h3>菜单</h3>
                <button class="close-menu" id="closeMenuBtn">✕</button>
            </div>
            <div class="menu-list" id="mobileMenuList"></div>
        </div>
    </div>
    
    <main class="rich-text">${page.content}</main>
    
    <div class="footer-nav">
        <div class="container">
            <div class="footer-col">
                <div class="footer-logo">${escapeHtml(settings.name)}</div>
                <p>${escapeHtml(settings.description)}</p>
            </div>
            ${bottomHtml || defaultBottom}
        </div>
    </div>
    <div class="footer-bottom">
        © 2025 ${escapeHtml(settings.name)}. 保留所有权利。
    </div>
    
    <script>
        // 手机端菜单
        const hamburger = document.getElementById('hamburgerBtn');
        const sideMenu = document.getElementById('sideMenu');
        const closeBtn = document.getElementById('closeMenuBtn');
        if (hamburger && sideMenu) {
            hamburger.addEventListener('click', () => sideMenu.classList.add('open'));
            if (closeBtn) closeBtn.addEventListener('click', () => sideMenu.classList.remove('open'));
            sideMenu.addEventListener('click', (e) => { if (e.target === sideMenu) sideMenu.classList.remove('open'); });
        }
        
        // 手机端菜单内容
        const menuList = document.getElementById('mobileMenuList');
        if (menuList) {
            menuList.innerHTML = \`${topHtml}\`;
            // 处理二级菜单展开
            const items = document.querySelectorAll('.nav-menu > li');
            items.forEach(item => {
                const dropdown = item.querySelector('.dropdown');
                if (dropdown) {
                    const parentSpan = document.createElement('div');
                    parentSpan.className = 'menu-parent';
                    const link = item.querySelector('a');
                    parentSpan.innerHTML = '<span>' + link.textContent + '</span><button class="toggle-sub">+</button>';
                    const submenuDiv = document.createElement('div');
                    submenuDiv.className = 'submenu';
                    submenuDiv.innerHTML = dropdown.innerHTML;
                    menuList.appendChild(parentSpan);
                    menuList.appendChild(submenuDiv);
                    const toggleBtn = parentSpan.querySelector('.toggle-sub');
                    toggleBtn.addEventListener('click', () => {
                        submenuDiv.classList.toggle('open');
                        toggleBtn.textContent = submenuDiv.classList.contains('open') ? '−' : '+';
                    });
                } else {
                    const link = item.querySelector('a');
                    const singleDiv = document.createElement('a');
                    singleDiv.className = 'menu-single';
                    singleDiv.href = link.href;
                    singleDiv.textContent = link.textContent;
                    menuList.appendChild(singleDiv);
                }
            });
        }
        
        function setLanguage(lang) {
            document.cookie = 'lang=' + lang + '; path=/; max-age=2592000';
            window.location.href = '?lang=' + lang;
        }
        
        // 手机端语言选择
        const mobileLangBtn = document.getElementById('mobileLangBtn');
        if (mobileLangBtn) {
            mobileLangBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const lang = prompt('选择语言 / Select Language:\\nEnglish (en)\\n中文 (zh)\\nEspañol (es)\\nFrançais (fr)\\nDeutsch (de)\\n日本語 (ja)\\n한국어 (ko)\\nالعربية (ar)');
                if (lang && ['en','zh','es','fr','de','ja','ko','ar'].includes(lang)) {
                    setLanguage(lang);
                }
            });
        }
        
        // 手机端搜索
        const mobileSearchBtn = document.getElementById('mobileSearchBtn');
        if (mobileSearchBtn) {
            mobileSearchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const query = prompt('搜索:');
                if (query && query.trim()) {
                    window.location.href = '/search?q=' + encodeURIComponent(query.trim());
                }
            });
        }
        
        // 电脑端搜索
        const searchBtn = document.querySelector('.search');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = prompt('搜索:');
                if (query && query.trim()) {
                    window.location.href = '/search?q=' + encodeURIComponent(query.trim());
                }
            });
        }
    </script>
</body>
</html>`;
  
  // 如果目标语言是中文，直接返回
  if (targetLang === 'zh') {
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  
  // 调用 AI 翻译
  const translatedHtml = await translateHtml(html, targetLang, env);
  
  return new Response(translatedHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

async function translateHtml(html, targetLang, env) {
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
    if (trimmed && trimmed.length > 2 && !trimmed.match(/^\d+$/) && !trimmed.includes('ZHAMIT')) {
      const placeholder = `{{T_${idx}}}`;
      texts.push(trimmed);
      placeholders.push({ placeholder, original: trimmed });
      idx++;
      return `>${placeholder}<`;
    }
    return match;
  });
  
  // 翻译每个文本块
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
