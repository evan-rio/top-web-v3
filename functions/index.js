// functions/index.js
// 服务端渲染 + AI 翻译

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 跳过 API 和静态资源
  if (path.startsWith('/api/') || path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|webp)$/)) {
    return next();
  }
  
  // 获取用户语言
  let targetLang = 'en';
  const cookieMatch = request.headers.get('Cookie')?.match(/lang=([^;]+)/);
  if (cookieMatch && ['en', 'zh', 'es', 'ar'].includes(cookieMatch[1])) {
    targetLang = cookieMatch[1];
  } else {
    const acceptLang = request.headers.get('Accept-Language') || '';
    if (acceptLang.includes('zh')) targetLang = 'zh';
    else if (acceptLang.includes('es')) targetLang = 'es';
    else if (acceptLang.includes('ar')) targetLang = 'ar';
  }
  
  // 从数据库获取导航数据
  let navData = [];
  try {
    const stmt = env.DB.prepare('SELECT * FROM nav_menus WHERE status = 1 ORDER BY location, parent_id, sort_order');
    const result = await stmt.all();
    navData = result.results || [];
  } catch (e) {
    console.error('获取导航失败', e);
  }
  
  // 生成 HTML
  let html = generateHTML(navData, targetLang);
  
  // 如果需要翻译，调用 AI
  if (targetLang !== 'en') {
    html = await translateWithAI(html, targetLang, env);
  }
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}

function generateHTML(navData, lang) {
  // 分离顶部和底部导航
  const topNav = navData.filter(i => i.location === 'top');
  const bottomNav = navData.filter(i => i.location === 'bottom');
  
  // 构建顶部导航 HTML
  const topParents = topNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  const topNavHtml = topParents.map(parent => {
    const children = topNav.filter(i => i.parent_id === parent.id).sort((a,b) => a.sort_order - b.sort_order);
    if (children.length) {
      return `<li>
        <a href="${parent.url}">${escapeHtml(parent.name)}</a>
        <div class="dropdown">${children.map(c => `<a href="${c.url}">${escapeHtml(c.name)}</a>`).join('')}</div>
      </li>`;
    }
    return `<li><a href="${parent.url}">${escapeHtml(parent.name)}</a></li>`;
  }).join('');
  
  // 构建底部导航 HTML
  const bottomParents = bottomNav.filter(i => i.parent_id === 0).sort((a,b) => a.sort_order - b.sort_order);
  const bottomNavHtml = bottomParents.map(parent => {
    const children = bottomNav.filter(i => i.parent_id === parent.id).sort((a,b) => a.sort_order - b.sort_order);
    if (children.length) {
      return `<div class="footer-col">
        <h4>${escapeHtml(parent.name)}</h4>
        ${children.map(c => `<a href="${c.url}">${escapeHtml(c.name)}</a>`).join('')}
      </div>`;
    }
    return `<div class="footer-col">
      <h4>${escapeHtml(parent.name)}</h4>
    </div>`;
  }).join('');
  
  // 默认底部（如果没有数据）
  const defaultBottom = bottomNavHtml || `
    <div class="footer-col">
      <h4>Quick Links</h4>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </div>
    <div class="footer-col">
      <h4>Contact Info</h4>
      <a href="mailto:info@zhamit.com">info@zhamit.com</a>
      <a href="tel:+8657912345678">+86 579 12345678</a>
    </div>
  `;
  
  const langDisplay = lang.toUpperCase();
  
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>ZHAMIT - Professional Trading Company</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.5; color: #1a1a1a; background: #fff; }

        @media (min-width: 768px) {
            .mobile-only { display: none !important; }
            .top-nav { background: #1a1a1a; position: sticky; top: 0; z-index: 200; padding: 0 40px; }
            .top-nav .container { max-width: 1400px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; height: 80px; }
            .company-name { font-size: 24px; font-weight: 700; color: white; letter-spacing: 1px; }
            .nav-menu { display: flex; gap: 32px; list-style: none; margin-left: auto; margin-right: 24px; }
            .nav-menu > li { position: relative; }
            .nav-menu > li > a { color: white; text-decoration: none; font-size: 16px; font-weight: 500; padding: 8px 0; display: block; }
            .nav-menu .dropdown { position: absolute; top: 100%; left: 0; background: white; min-width: 180px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px; opacity: 0; visibility: hidden; transition: all 0.2s; z-index: 100; }
            .nav-menu > li:hover .dropdown { opacity: 1; visibility: visible; }
            .dropdown a { display: block; padding: 12px 16px; color: #333; text-decoration: none; font-size: 14px; }
            .dropdown a:hover { background: #f5f5f5; }
            .toolbar { display: flex; align-items: center; gap: 20px; }
            .lang-selector { position: relative; }
            .lang-btn { background: none; border: none; color: white; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 6px; padding: 6px 8px; font-weight: 500; }
            .lang-menu { position: absolute; top: 100%; right: 0; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: none; z-index: 100; min-width: 120px; }
            .lang-selector:hover .lang-menu { display: block; }
            .lang-menu a { display: block; padding: 10px 16px; color: #333; text-decoration: none; font-size: 14px; cursor: pointer; }
            .lang-menu a:hover { background: #f5f5f5; }
            .search-wrapper { position: relative; }
            .search-icon { background: none; border: none; cursor: pointer; padding: 6px; display: flex; align-items: center; }
            .search-icon svg { width: 20px; height: 20px; stroke: white; stroke-width: 1.5; fill: none; }
            .search-input-container { position: absolute; right: 0; top: 100%; background: white; border: 1px solid #e0e0e0; border-radius: 30px; padding: 8px 16px; width: 240px; display: none; margin-top: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .search-wrapper:hover .search-input-container { display: block; }
            .search-input-container input { border: none; outline: none; width: 100%; font-size: 14px; padding: 6px 0; }
            .footer-nav { background: #f8f8f8; padding: 60px 40px 40px; margin-top: 80px; border-top: 1px solid #e8e8e8; }
            .footer-nav .container { max-width: 1400px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 48px; }
            .footer-col { flex: 1; min-width: 160px; }
            .footer-col .footer-logo { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 16px; display: inline-block; }
            .footer-col p { color: #666; font-size: 14px; line-height: 1.6; margin-top: 8px; }
            .footer-col h4 { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 16px; }
            .footer-col a { display: block; color: #666; text-decoration: none; font-size: 14px; margin-bottom: 12px; transition: color 0.2s; }
            .footer-col a:hover { color: #1a1a1a; }
            .footer-bottom { max-width: 1400px; margin: 40px auto 0; padding-top: 24px; border-top: 1px solid #e8e8e8; text-align: center; font-size: 13px; color: #999; }
            .hero { padding: 100px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .hero h1 { font-size: 56px; font-weight: 700; margin-bottom: 20px; }
            .hero p { font-size: 18px; opacity: 0.9; max-width: 600px; margin: 0 auto; }
            .products { padding: 80px 40px; max-width: 1400px; margin: 0 auto; }
            .products h2 { text-align: center; font-size: 36px; font-weight: 600; margin-bottom: 48px; }
            .product-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; }
            .product-card { background: #f9f9f9; border-radius: 16px; padding: 40px 24px; text-align: center; transition: transform 0.2s; }
            .product-card:hover { transform: translateY(-4px); }
            .product-card h3 { font-size: 22px; font-weight: 600; margin-bottom: 12px; }
            .product-card p { color: #666; font-size: 15px; }
        }

        @media (max-width: 767px) {
            .desktop-only { display: none !important; }
            .top-nav { background: #1a1a1a; position: sticky; top: 0; z-index: 200; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
            .hamburger { background: none; border: none; width: 30px; height: 30px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 6px 0; cursor: pointer; }
            .hamburger span { display: block; width: 22px; height: 2px; background: white; border-radius: 2px; }
            .mobile-logo { font-size: 20px; font-weight: 700; color: white; }
            .mobile-toolbar { display: flex; gap: 16px; align-items: center; position: relative; }
            .mobile-lang-btn, .mobile-search-btn { background: none; border: none; color: white; cursor: pointer; font-size: 16px; display: flex; align-items: center; gap: 4px; padding: 4px; }
            .mobile-lang-btn span { font-size: 12px; }
            .mobile-search-btn svg { width: 18px; height: 18px; stroke: white; stroke-width: 1.5; fill: none; }
            .lang-modal { position: fixed; top: 56px; right: 16px; background: white; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 400; display: none; overflow: hidden; min-width: 140px; animation: fadeIn 0.2s ease; }
            .lang-modal.show { display: block; }
            .lang-modal-option { padding: 12px 20px; cursor: pointer; text-align: center; font-size: 15px; transition: background 0.2s; }
            .lang-modal-option:hover { background: #f5f5f5; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
            .search-modal { position: fixed; top: 56px; right: 16px; background: white; border-radius: 30px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 400; display: none; padding: 8px 16px; width: 240px; animation: fadeIn 0.2s ease; }
            .search-modal.show { display: flex; align-items: center; gap: 8px; }
            .search-modal input { flex: 1; border: none; outline: none; font-size: 14px; padding: 8px 0; }
            .search-modal button { background: none; border: none; cursor: pointer; font-size: 16px; color: #666; }
            .side-menu { position: fixed; top: 0; left: 0; width: 85%; max-width: 320px; height: 100%; background: white; z-index: 300; transform: translateX(-100%); transition: transform 0.3s ease; box-shadow: 2px 0 12px rgba(0,0,0,0.1); overflow-y: auto; }
            .side-menu.open { transform: translateX(0); }
            .menu-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            .menu-header h3 { font-size: 18px; }
            .close-menu { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; }
            .menu-list { padding: 8px 0; }
            .menu-item { border-bottom: 1px solid #f0f0f0; }
            .menu-parent { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; cursor: pointer; }
            .menu-parent span { font-size: 16px; font-weight: 500; }
            .toggle-sub { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; width: 30px; }
            .submenu { display: none; background: #f9f9f9; padding-left: 20px; }
            .submenu.open { display: block; }
            .submenu a { display: block; padding: 12px 20px; color: #666; text-decoration: none; font-size: 14px; }
            .menu-single { display: block; padding: 14px 20px; color: #333; text-decoration: none; font-size: 16px; }
            .hero { padding: 60px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .hero h1 { font-size: 32px; font-weight: 700; margin-bottom: 12px; }
            .hero p { font-size: 14px; opacity: 0.9; }
            .products { padding: 48px 16px; }
            .products h2 { text-align: center; font-size: 24px; font-weight: 600; margin-bottom: 24px; }
            .product-card { background: #f9f9f9; border-radius: 12px; padding: 24px 16px; margin-bottom: 16px; text-align: center; }
            .product-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
            .product-card p { color: #666; font-size: 13px; }
            .footer-nav { background: #f8f8f8; padding: 40px 20px 24px; margin-top: 48px; }
            .footer-nav .container { display: flex; flex-direction: column; gap: 32px; }
            .footer-col { text-align: center; }
            .footer-col .footer-logo { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 12px; display: inline-block; }
            .footer-col p { color: #666; font-size: 13px; margin-top: 4px; }
            .footer-col h4 { font-size: 15px; font-weight: 600; color: #333; margin-bottom: 12px; }
            .footer-col a { display: block; color: #666; text-decoration: none; font-size: 13px; margin-bottom: 8px; }
            .footer-bottom { text-align: center; padding-top: 24px; margin-top: 24px; border-top: 1px solid #e8e8e8; font-size: 11px; color: #999; }
        }
    </style>
</head>
<body>
    <!-- ========== 电脑端 ========== -->
    <div class="desktop-only">
        <div class="top-nav">
            <div class="container">
                <div class="logo-area">
                    <span class="company-name">ZHAMIT</span>
                </div>
                <ul class="nav-menu">
                    ${topNavHtml}
                </ul>
                <div class="toolbar">
                    <div class="lang-selector">
                        <button class="lang-btn">
                            🌐 <span>${langDisplay}</span>
                        </button>
                        <div class="lang-menu">
                            <a href="#" onclick="setLanguage('en'); return false;">English</a>
                            <a href="#" onclick="setLanguage('zh'); return false;">中文</a>
                            <a href="#" onclick="setLanguage('es'); return false;">Español</a>
                            <a href="#" onclick="setLanguage('ar'); return false;">العربية</a>
                        </div>
                    </div>
                    <div class="search-wrapper">
                        <button class="search-icon">
                            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none">
                                <circle cx="10" cy="10" r="7" />
                                <line x1="15" y1="15" x2="21" y2="21" />
                            </svg>
                        </button>
                        <div class="search-input-container">
                            <input type="text" id="searchInputDesktop" placeholder="Search...">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <main>
            <section class="hero">
                <h1>ZHAMIT</h1>
                <p>Professional Trading Company · From Yiwu, China</p>
            </section>
            <section class="products">
                <h2>Featured Products</h2>
                <div class="product-grid">
                    <div class="product-card">
                        <h3>Home Goods</h3>
                        <p>High-quality home goods, in stock</p>
                    </div>
                    <div class="product-card">
                        <h3>Kitchenware</h3>
                        <p>Practical & beautiful, custom packaging available</p>
                    </div>
                    <div class="product-card">
                        <h3>Decorations</h3>
                        <p>Limited editions, updated weekly</p>
                    </div>
                </div>
            </section>
        </main>

        <div class="footer-nav">
            <div class="container">
                ${defaultBottom}
            </div>
            <div class="footer-bottom">
                © 2025 YIWU ZHAMIT TRADING LIMITED. All Rights Reserved.
            </div>
        </div>
    </div>

    <!-- ========== 手机端 ========== -->
    <div class="mobile-only">
        <div class="top-nav">
            <button class="hamburger" id="hamburgerBtn">
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div class="mobile-logo">ZHAMIT</div>
            <div class="mobile-toolbar">
                <button class="mobile-lang-btn" id="mobileLangBtn">
                    🌐 <span>${langDisplay}</span>
                </button>
                <button class="mobile-search-btn" id="mobileSearchBtn">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none">
                        <circle cx="10" cy="10" r="7" />
                        <line x1="15" y1="15" x2="21" y2="21" />
                    </svg>
                </button>
            </div>
        </div>

        <div class="lang-modal" id="langModal">
            <div class="lang-modal-option" onclick="setLanguage('en')">English</div>
            <div class="lang-modal-option" onclick="setLanguage('zh')">中文</div>
            <div class="lang-modal-option" onclick="setLanguage('es')">Español</div>
            <div class="lang-modal-option" onclick="setLanguage('ar')">العربية</div>
        </div>

        <div class="search-modal" id="searchModal">
            <input type="text" id="mobileSearchInput" placeholder="Search...">
            <button id="mobileSearchConfirm">🔍</button>
        </div>

        <div class="side-menu" id="sideMenu">
            <div class="menu-header">
                <h3>Menu</h3>
                <button class="close-menu" id="closeMenuBtn">✕</button>
            </div>
            <div class="menu-list" id="mobileMenuList">
                ${topNavHtml}
            </div>
        </div>

        <main>
            <section class="hero">
                <h1>ZHAMIT</h1>
                <p>Professional Trading Company · From Yiwu, China</p>
            </section>
            <section class="products">
                <h2>Featured Products</h2>
                <div class="product-grid">
                    <div class="product-card">
                        <h3>Home Goods</h3>
                        <p>High-quality home goods, in stock</p>
                    </div>
                    <div class="product-card">
                        <h3>Kitchenware</h3>
                        <p>Practical & beautiful, custom packaging available</p>
                    </div>
                    <div class="product-card">
                        <h3>Decorations</h3>
                        <p>Limited editions, updated weekly</p>
                    </div>
                </div>
            </section>
        </main>

        <div class="footer-nav">
            <div class="container">
                ${defaultBottom}
            </div>
            <div class="footer-bottom">
                © 2025 YIWU ZHAMIT TRADING LIMITED. All Rights Reserved.
            </div>
        </div>
    </div>

    <script>
        function setLanguage(lang) {
            document.cookie = 'lang=' + lang + '; path=/; max-age=2592000';
            window.location.reload();
        }
        
        // 手机端菜单
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
                e.stopPropagation();
                langModal.classList.toggle('show');
            });
            document.addEventListener('click', (e) => {
                if (!langModal.contains(e.target) && e.target !== mobileLangBtn) {
                    langModal.classList.remove('show');
                }
            });
        }
        
        // 搜索功能
        const searchIcon = document.querySelector('.search-icon');
        const searchContainer = document.querySelector('.search-input-container');
        if (searchIcon && searchContainer) {
            searchIcon.addEventListener('click', () => {
                const input = searchContainer.querySelector('input');
                if (input && input.value.trim()) {
                    window.location.href = '/search?q=' + encodeURIComponent(input.value.trim());
                }
            });
        }
        
        const mobileSearchBtn = document.getElementById('mobileSearchBtn');
        const mobileSearchModal = document.getElementById('searchModal');
        const mobileSearchInput = document.getElementById('mobileSearchInput');
        const mobileSearchConfirm = document.getElementById('mobileSearchConfirm');
        if (mobileSearchBtn && mobileSearchModal) {
            mobileSearchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                mobileSearchModal.classList.toggle('show');
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
                if (!mobileSearchModal.contains(e.target) && e.target !== mobileSearchBtn) {
                    mobileSearchModal.classList.remove('show');
                }
            });
        }
        
        // 电脑端搜索
        const desktopSearchInput = document.getElementById('searchInputDesktop');
        if (desktopSearchInput) {
            desktopSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && desktopSearchInput.value.trim()) {
                    window.location.href = '/search?q=' + encodeURIComponent(desktopSearchInput.value.trim());
                }
            });
        }
    </script>
</body>
</html>`;
}

// AI 翻译函数
async function translateWithAI(html, targetLang, env) {
  if (!env.AI) {
    console.error('AI binding not found');
    return html;
  }
  
  // 提取 body 内容进行翻译
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return html;
  
  const bodyContent = bodyMatch[1];
  const beforeBody = html.substring(0, bodyMatch.index);
  const afterBody = html.substring(bodyMatch.index + bodyMatch[0].length);
  
  // 提取所有文本节点（简化：用正则提取标签外的文本）
  const textBlocks = [];
  const placeholders = [];
  let tempContent = bodyContent;
  let index = 0;
  
  tempContent = bodyContent.replace(/>([^<]+)</g, (match, text) => {
    const trimmed = text.trim();
    if (trimmed && !trimmed.match(/^[\d\s\W]+$/)) {
      const placeholder = `{{TEXT_${index}}}`;
      textBlocks.push(trimmed);
      placeholders.push({ placeholder, original: trimmed });
      index++;
      return `>${placeholder}<`;
    }
    return match;
  });
  
  // 批量翻译
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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}
