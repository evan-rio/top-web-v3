// functions/index.js - 优化版：锁定 ZHAMIT + 缓存

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
  
  // 如果是中文，直接返回（不缓存）
  if (targetLang === 'zh') {
    const html = await generateHTML(env, path);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
  
  // 检查缓存
  const cacheKey = `https://zhamit.com/cache/${targetLang}${path}`;
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    console.log('使用缓存:', cacheKey);
    return cached;
  }
  
  // 生成并翻译
  console.log('生成新翻译:', cacheKey);
  const html = await generateHTML(env, path);
  const translatedHtml = await translateHtml(html, targetLang, env);
  
  // 存入缓存（1小时）
  const response = new Response(translatedHtml, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
  await caches.default.put(cacheKey, response.clone());
  
  return response;
}

async function generateHTML(env, path) {
  // 获取站点设置
  let settings = { name: '哲觅贸易', description: '专业家居贸易公司 · 源自中国义乌' };
  try {
    const stmt = env.DB.prepare('SELECT * FROM site_settings');
    const rows = await stmt.all();
    for (const row of rows.results) {
      settings[row.key] = row.value_zh || row.value;
    }
  } catch (e) {}
  
  // 获取导航数据
  let navData = [];
  try {
    const stmt = env.DB.prepare('SELECT * FROM nav_menus WHERE status = 1 ORDER BY location, parent_id, sort_order');
    const rows = await stmt.all();
    navData = rows.results.map(item => ({
      ...item,
      name: item.name_zh || item.name
    }));
  } catch (e) {}
  
  // 获取页面内容
  let page = { title: settings.name, content: '<h1>欢迎</h1><p>欢迎访问我们的网站。</p>' };
  try {
    const stmt = env.DB.prepare('SELECT * FROM pages WHERE path = ? AND status = 1 LIMIT 1');
    const result = await stmt.bind(path === '/' ? '/' : path).first();
    if (result) {
      page.title = result.title_zh || result.title;
      page.content = result.content_zh || result.content;
    }
  } catch (e) {}
  
  // 生成顶部导航
  const topNav = navData.filter(i => i.location === 'top');
  const topParents = topNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  const topHtml = topParents.map(parent => {
    const children = topNav.filter(i => i.parent_id === parent.id).sort((a,b) => a.sort_order - b.sort_order);
    if (children.length) {
      return `<li><a href="${parent.url}">${escapeHtml(parent.name)}</a><ul class="dropdown">${children.map(c => `<li><a href="${c.url}">${escapeHtml(c.name)}</a></li>`).join('')}</ul></li>`;
    }
    return `<li><a href="${parent.url}">${escapeHtml(parent.name)}</a></li>`;
  }).join('');
  
  // 生成底部导航
  const bottomNav = navData.filter(i => i.location === 'bottom');
  const bottomParents = bottomNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  const bottomHtml = bottomParents.map(parent => {
    const children = bottomNav.filter(i => i.parent_id === parent.id).sort((a,b) => a.sort_order - b.sort_order);
    if (children.length) {
      return `<div class="footer-col"><h4>${escapeHtml(parent.name)}</h4>${children.map(c => `<a href="${c.url}">${escapeHtml(c.name)}</a>`).join('')}</div>`;
    }
    return `<div class="footer-col"><h4>${escapeHtml(parent.name)}</h4></div>`;
  }).join('');
  
  const defaultBottom = `<div class="footer-col"><h4>快速链接</h4><a href="/about">关于我们</a><a href="/contact">联系我们</a></div><div class="footer-col"><h4>联系方式</h4><a href="mailto:info@zhamit.com">info@zhamit.com</a><a href="tel:+8657912345678">+86 579 12345678</a></div>`;
  
  return `<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>${escapeHtml(page.title)} - ${escapeHtml(settings.name)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui; line-height: 1.5; }
        
        /* 电脑端样式 */
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
            .lang-menu a:hover { background: #f5f5f5; }
            .search { cursor: pointer; }
            .mobile-only { display: none !important; }
        }
        
        /* 手机端样式 */
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
            .lang-modal { position: fixed; top: 56px; right: 16px; background: white; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 400; display: none; overflow: hidden; min-width: 140px; }
            .lang-modal.show { display: block; }
            .lang-modal-option { padding: 12px 20px; cursor: pointer; text-align: center; font-size: 15px; }
            .lang-modal-option:hover { background: #f5f5f5; }
            .search-modal { position: fixed; top: 56px; right: 16px; background: white; border-radius: 30px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 400; display: none; padding: 8px 16px; width: 240px; }
            .search-modal.show { display: flex; align-items: center; gap: 8px; }
            .search-modal input { flex: 1; border: none; outline: none; font-size: 14px; padding: 8px 0; }
            .search-modal button { background: none; border: none; cursor: pointer; font-size: 16px; color: #666; }
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
    <!-- 电脑端 -->
    <div class="desktop-only">
        <div class="top-nav">
            <div class="container">
                <div class="logo">${escapeHtml(settings.name)}</div>
                <ul class="nav-menu">${topHtml}</ul>
                <div class="toolbar">
                    <div class="lang-selector">
                        <button class="lang-btn">🌐 EN</button>
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
    
    <!-- 手机端 -->
    <div class="mobile-only">
        <div class="top-nav">
            <button class="hamburger" id="hamburgerBtn"><span></span><span></span><span></span></button>
            <div class="mobile-logo">${escapeHtml(settings.name)}</div>
            <div class="mobile-toolbar">
                <button class="mobile-lang-btn" id="mobileLangBtn">🌐 <span id="mobileLangDisplay">EN</span></button>
                <button class="mobile-search-btn" id="mobileSearchBtn">🔍</button>
            </div>
        </div>
        
        <div class="lang-modal" id="langModal">
            <div class="lang-modal-option" onclick="setLanguage('en')">English</div>
            <div class="lang-modal-option" onclick="setLanguage('zh')">中文</div>
            <div class="lang-modal-option" onclick="setLanguage('es')">Español</div>
            <div class="lang-modal-option" onclick="setLanguage('fr')">Français</div>
            <div class="lang-modal-option" onclick="setLanguage('de')">Deutsch</div>
            <div class="lang-modal-option" onclick="setLanguage('ja')">日本語</div>
            <div class="lang-modal-option" onclick="setLanguage('ko')">한국어</div>
            <div class="lang-modal-option" onclick="setLanguage('ar')">العربية</div>
            <div class="lang-modal-option" onclick="setLanguage('ru')">Русский</div>
            <div class="lang-modal-option" onclick="setLanguage('pt')">Português</div>
            <div class="lang-modal-option" onclick="setLanguage('it')">Italiano</div>
        </div>
        
        <div class="search-modal" id="searchModal">
            <input type="text" id="mobileSearchInput" placeholder="搜索...">
            <button id="mobileSearchConfirm">🔍</button>
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
            document.querySelectorAll('.menu-parent').forEach(el => {});
        }
        
        function setLanguage(lang) {
            document.cookie = 'lang=' + lang + '; path=/; max-age=2592000';
            window.location.href = '?lang=' + lang;
        }
        
        // 手机端语言选择
        const mobileLangBtn = document.getElementById('mobileLangBtn');
        const langModal = document.getElementById('langModal');
        if (mobileLangBtn && langModal) {
            mobileLangBtn.addEventListener('click', (e) => {
                e.preventDefault();
                langModal.classList.toggle('show');
            });
            document.addEventListener('click', (e) => {
                if (!langModal.contains(e.target) && e.target !== mobileLangBtn) {
                    langModal.classList.remove('show');
                }
            });
        }
        
        // 手机端搜索
        const mobileSearchBtn = document.getElementById('mobileSearchBtn');
        const searchModal = document.getElementById('searchModal');
        const searchInput = document.getElementById('mobileSearchInput');
        const searchConfirm = document.getElementById('mobileSearchConfirm');
        if (mobileSearchBtn && searchModal) {
            mobileSearchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                searchModal.classList.toggle('show');
                if (searchInput) searchInput.focus();
            });
            const doSearch = () => {
                if (searchInput && searchInput.value.trim()) {
                    window.location.href = '/search?q=' + encodeURIComponent(searchInput.value.trim());
                }
            };
            if (searchConfirm) searchConfirm.addEventListener('click', doSearch);
            if (searchInput) searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(); });
            document.addEventListener('click', (e) => {
                if (!searchModal.contains(e.target) && e.target !== mobileSearchBtn) {
                    searchModal.classList.remove('show');
                }
            });
        }
        
        // 更新语言显示
        const urlParams = new URLSearchParams(window.location.search);
        const currentLang = urlParams.get('lang') || 'zh';
        const langNames = { en: 'EN', zh: '中文', es: 'ES', fr: 'FR', de: 'DE', ja: '日', ko: '韩', ar: 'عربي', ru: 'RU', pt: 'PT', it: 'IT' };
        const displayLang = langNames[currentLang] || currentLang.toUpperCase();
        const desktopLangSpan = document.querySelector('.lang-btn span');
        const mobileLangSpan = document.getElementById('mobileLangDisplay');
        if (desktopLangSpan) desktopLangSpan.textContent = displayLang;
        if (mobileLangSpan) mobileLangSpan.textContent = displayLang;
    </script>
</body>
</html>`;
}

async function translateHtml(html, targetLang, env) {
  if (!env.AI) return html;
  
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return html;
  
  const bodyContent = bodyMatch[1];
  const beforeBody = html.substring(0, bodyMatch.index);
  const afterBody = html.substring(bodyMatch.index + bodyMatch[0].length);
  
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
  
  console.log(`翻译 ${texts.length} 个文本块`);
  
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
