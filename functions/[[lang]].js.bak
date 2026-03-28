// functions/[[lang]].js
// 带缓存的动态页面生成（不使用 R2）

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 跳过 API
  if (path.startsWith('/api/')) {
    return next();
  }
  
  // 静态资源交给 Pages 默认处理
  if (path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|webp)$/)) {
    return next();
  }
  
  // 解析语言和页面路径
  const parts = path.split('/').filter(p => p);
  const lang = parts[0] || 'zh';
  const pagePath = '/' + (parts.slice(1).join('/') || '');
  
  // 支持的语种
  const supportedLangs = ['zh', 'en', 'es', 'ar'];
  if (!supportedLangs.includes(lang)) {
    return new Response('Not Found', { status: 404 });
  }
  
  // 检查缓存
  const cacheKey = `https://zhamit.com/${lang}${pagePath}`;
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    console.log('命中缓存:', cacheKey);
    return cached;
  }
  
  console.log('生成新页面:', cacheKey);
  
  // 获取数据
  const settings = await getSettings(env, lang);
  const navData = await getNavData(env, lang);
  const page = await getPage(env, pagePath, lang);
  
  // 生成 HTML
  const html = generateHTML(settings, navData, page, lang);
  
  // 存入缓存（1小时）
  const response = new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
  await caches.default.put(cacheKey, response.clone());
  
  return response;
}

// 获取站点设置
async function getSettings(env, lang) {
  try {
    const rows = await env.DB.prepare('SELECT * FROM site_settings').all();
    const settings = {
      name: '哲觅贸易',
      description: '专业家居贸易公司 · 源自中国义乌'
    };
    for (const row of rows.results) {
      settings[row.key] = row[`value_${lang}`] || row.value_zh;
    }
    return settings;
  } catch (e) {
    return { name: '哲觅贸易', description: '专业家居贸易公司 · 源自中国义乌' };
  }
}

// 获取导航数据
async function getNavData(env, lang) {
  try {
    const rows = await env.DB.prepare('SELECT * FROM nav_menus WHERE status = 1 ORDER BY location, parent_id, sort_order').all();
    return rows.results.map(item => ({
      ...item,
      name: item[`name_${lang}`] || item.name_zh
    }));
  } catch (e) {
    return [];
  }
}

// 获取页面内容
async function getPage(env, path, lang) {
  try {
    const result = await env.DB.prepare('SELECT * FROM pages WHERE path = ? AND status = 1 LIMIT 1').bind(path).first();
    if (!result) return null;
    return {
      title: result[`title_${lang}`] || result.title_zh,
      content: result[`content_${lang}`] || result.content_zh
    };
  } catch (e) {
    return null;
  }
}

function generateHTML(settings, navData, page, lang) {
  const langNames = {
    zh: '中文', en: 'EN', es: 'ES', ar: 'عربي'
  };
  
  // 构建顶部导航
  const topNav = navData.filter(i => i.location === 'top');
  const topParents = topNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  let topHtml = '';
  for (const p of topParents) {
    const children = topNav.filter(i => i.parent_id === p.id).sort((a,b) => a.sort_order - b.sort_order);
    if (children.length) {
      topHtml += `<li><a href="/${lang}${p.url}">${escapeHtml(p.name)}</a><ul class="dropdown">`;
      for (const c of children) {
        topHtml += `<li><a href="/${lang}${c.url}">${escapeHtml(c.name)}</a></li>`;
      }
      topHtml += `</ul></li>`;
    } else {
      topHtml += `<li><a href="/${lang}${p.url}">${escapeHtml(p.name)}</a></li>`;
    }
  }
  
  // 构建底部导航
  const bottomNav = navData.filter(i => i.location === 'bottom');
  const bottomParents = bottomNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  let bottomHtml = '';
  for (const p of bottomParents) {
    const children = bottomNav.filter(i => i.parent_id === p.id).sort((a,b) => a.sort_order - b.sort_order);
    if (children.length) {
      bottomHtml += `<div class="footer-col"><h4>${escapeHtml(p.name)}</h4>`;
      for (const c of children) {
        bottomHtml += `<a href="/${lang}${c.url}">${escapeHtml(c.name)}</a>`;
      }
      bottomHtml += `</div>`;
    } else {
      bottomHtml += `<div class="footer-col"><h4>${escapeHtml(p.name)}</h4></div>`;
    }
  }
  
  const defaultBottom = `<div class="footer-col"><h4>快速链接</h4><a href="/${lang}/about">关于我们</a><a href="/${lang}/contact">联系我们</a></div><div class="footer-col"><h4>联系方式</h4><a href="mailto:info@zhamit.com">info@zhamit.com</a><a href="tel:+8657912345678">+86 579 12345678</a></div>`;
  
  const pageTitle = page?.title || settings.name;
  const pageContent = page?.content || '<h1>欢迎</h1><p>欢迎访问我们的网站。</p>';
  
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>${escapeHtml(pageTitle)} - ${escapeHtml(settings.name)}</title>
    <link rel="alternate" hreflang="zh" href="/zh/">
    <link rel="alternate" hreflang="en" href="/en/">
    <link rel="alternate" hreflang="es" href="/es/">
    <link rel="alternate" hreflang="ar" href="/ar/">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui; line-height: 1.5; }
        
        @media (min-width: 769px) {
            .top-nav { background: #1a1a1a; color: white; padding: 0 20px; position: sticky; top: 0; z-index: 100; }
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
            .top-nav { background: #1a1a1a; color: white; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
            .hamburger { background: none; border: none; width: 28px; height: 28px; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; }
            .hamburger span { display: block; width: 100%; height: 2px; background: white; border-radius: 2px; }
            .mobile-logo { font-size: 18px; font-weight: bold; }
            .mobile-toolbar { display: flex; gap: 12px; }
            .mobile-lang-btn, .mobile-search-btn { background: none; border: none; color: white; font-size: 18px; cursor: pointer; }
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
            .lang-modal { position: fixed; bottom: 0; left: 0; right: 0; background: white; border-radius: 20px 20px 0 0; z-index: 400; display: none; overflow: hidden; animation: slideUp 0.3s; }
            .lang-modal.show { display: block; }
            .lang-modal-header { padding: 16px; text-align: center; font-weight: bold; border-bottom: 1px solid #eee; }
            .lang-modal-option { padding: 14px 20px; text-align: center; cursor: pointer; border-bottom: 1px solid #f0f0f0; }
            .search-modal { position: fixed; bottom: 0; left: 0; right: 0; background: white; border-radius: 20px 20px 0 0; z-index: 400; display: none; padding: 20px; animation: slideUp 0.3s; }
            .search-modal.show { display: block; }
            .search-modal input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 30px; font-size: 16px; margin-bottom: 12px; }
            .search-modal button { width: 100%; padding: 12px; background: #1a1a1a; color: white; border: none; border-radius: 30px; font-size: 16px; cursor: pointer; }
            @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
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
                        <button class="lang-btn" id="desktopLangBtn">🌐 ${langNames[lang]}</button>
                        <div class="lang-menu" id="desktopLangMenu">
                            <a href="/zh/">中文</a>
                            <a href="/en/">English</a>
                            <a href="/es/">Español</a>
                            <a href="/ar/">العربية</a>
                        </div>
                    </div>
                    <div class="search" id="desktopSearchBtn">🔍</div>
                </div>
            </div>
        </div>
    </div>
    
    <div class="mobile-only">
        <div class="top-nav">
            <button class="hamburger" id="hamburgerBtn"><span></span><span></span><span></span></button>
            <div class="mobile-logo">${escapeHtml(settings.name)}</div>
            <div class="mobile-toolbar">
                <button class="mobile-lang-btn" id="mobileLangBtn">🌐</button>
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
        
        <div class="lang-modal" id="langModal">
            <div class="lang-modal-header">选择语言</div>
            <div class="lang-modal-option" data-lang="zh">中文</div>
            <div class="lang-modal-option" data-lang="en">English</div>
            <div class="lang-modal-option" data-lang="es">Español</div>
            <div class="lang-modal-option" data-lang="ar">العربية</div>
        </div>
        
        <div class="search-modal" id="searchModal">
            <input type="text" id="mobileSearchInput" placeholder="搜索...">
            <button id="mobileSearchConfirm">搜索</button>
        </div>
    </div>
    
    <main class="rich-text">${pageContent}</main>
    
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
        // 手机端菜单内容
        const menuList = document.getElementById('mobileMenuList');
        if (menuList) {
            const topHtml = \`${topHtml}\`;
            const parser = new DOMParser();
            const doc = parser.parseFromString('<ul>' + topHtml + '</ul>', 'text/html');
            const items = doc.querySelectorAll('li');
            items.forEach(item => {
                const link = item.querySelector('a');
                const dropdown = item.querySelector('.dropdown');
                if (dropdown) {
                    const parentDiv = document.createElement('div');
                    parentDiv.className = 'menu-parent';
                    parentDiv.innerHTML = '<span>' + link.textContent + '</span><button class="toggle-sub">+</button>';
                    const subDiv = document.createElement('div');
                    subDiv.className = 'submenu';
                    const subLinks = dropdown.querySelectorAll('a');
                    subLinks.forEach(subLink => {
                        const a = document.createElement('a');
                        a.href = subLink.href;
                        a.textContent = subLink.textContent;
                        subDiv.appendChild(a);
                    });
                    menuList.appendChild(parentDiv);
                    menuList.appendChild(subDiv);
                    const toggle = parentDiv.querySelector('.toggle-sub');
                    toggle.addEventListener('click', () => {
                        subDiv.classList.toggle('open');
                        toggle.textContent = subDiv.classList.contains('open') ? '−' : '+';
                    });
                } else {
                    const a = document.createElement('a');
                    a.className = 'menu-single';
                    a.href = link.href;
                    a.textContent = link.textContent;
                    menuList.appendChild(a);
                }
            });
        }
        
        function setLanguage(lang) {
            document.cookie = 'lang=' + lang + '; path=/; max-age=2592000';
            window.location.href = '/' + lang + '/';
        }
        
        // 手机端菜单开关
        const hamburger = document.getElementById('hamburgerBtn');
        const sideMenu = document.getElementById('sideMenu');
        const closeBtn = document.getElementById('closeMenuBtn');
        if (hamburger && sideMenu) {
            hamburger.addEventListener('click', () => sideMenu.classList.add('open'));
            if (closeBtn) closeBtn.addEventListener('click', () => sideMenu.classList.remove('open'));
            sideMenu.addEventListener('click', (e) => { if (e.target === sideMenu) sideMenu.classList.remove('open'); });
        }
        
        // 手机端语言选择
        const mobileLangBtn = document.getElementById('mobileLangBtn');
        const langModal = document.getElementById('langModal');
        if (mobileLangBtn && langModal) {
            mobileLangBtn.addEventListener('click', (e) => {
                e.preventDefault();
                langModal.classList.add('show');
            });
            langModal.querySelectorAll('.lang-modal-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    setLanguage(opt.dataset.lang);
                    langModal.classList.remove('show');
                });
            });
            document.addEventListener('click', (e) => {
                if (!langModal.contains(e.target) && e.target !== mobileLangBtn) {
                    langModal.classList.remove('show');
                }
            });
        }
        
        // 手机端搜索
        const searchModal = document.getElementById('searchModal');
        const mobileSearchBtn = document.getElementById('mobileSearchBtn');
        const mobileSearchInput = document.getElementById('mobileSearchInput');
        const mobileSearchConfirm = document.getElementById('mobileSearchConfirm');
        if (mobileSearchBtn && searchModal) {
            mobileSearchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                searchModal.classList.add('show');
                if (mobileSearchInput) mobileSearchInput.focus();
            });
            const doSearch = () => {
                if (mobileSearchInput && mobileSearchInput.value.trim()) {
                    window.location.href = '/search?q=' + encodeURIComponent(mobileSearchInput.value.trim());
                }
            };
            if (mobileSearchConfirm) mobileSearchConfirm.addEventListener('click', doSearch);
            if (mobileSearchInput) mobileSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(); });
            document.addEventListener('click', (e) => {
                if (!searchModal.contains(e.target) && e.target !== mobileSearchBtn) {
                    searchModal.classList.remove('show');
                }
            });
        }
        
        // 电脑端搜索
        const desktopSearchBtn = document.getElementById('desktopSearchBtn');
        if (desktopSearchBtn) {
            desktopSearchBtn.addEventListener('click', () => {
                const query = prompt('搜索:');
                if (query && query.trim()) {
                    window.location.href = '/search?q=' + encodeURIComponent(query.trim());
                }
            });
        }
    </script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}
