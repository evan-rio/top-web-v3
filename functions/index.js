// functions/index.js - 第二步：完整 HTML 渲染，不翻译

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 跳过 API 和静态资源
  if (path.startsWith('/api/') || path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|webp)$/)) {
    return context.next();
  }
  
  // 获取导航数据
  let navData = [];
  try {
    const stmt = env.DB.prepare('SELECT * FROM nav_menus WHERE status = 1 ORDER BY location, parent_id, sort_order LIMIT 10');
    const rows = await stmt.all();
    navData = rows.results || [];
  } catch (e) {
    console.error('数据库错误:', e);
  }
  
  // 生成简单的导航 HTML
  const topNav = navData.filter(i => i.location === 'top');
  const topParents = topNav.filter(i => i.parent_id === 0);
  const topHtml = topParents.map(parent => {
    return `<li><a href="${parent.url}">${escapeHtml(parent.name)}</a></li>`;
  }).join('');
  
  const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ZHAMIT</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui; }
        .top-nav { background: #1a1a1a; color: white; padding: 15px 20px; }
        .nav-menu { display: flex; gap: 30px; list-style: none; }
        .nav-menu a { color: white; text-decoration: none; }
        main { padding: 40px 20px; max-width: 1200px; margin: 0 auto; }
        .footer { background: #f5f5f5; padding: 20px; text-align: center; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="top-nav">
        <ul class="nav-menu">
            ${topHtml}
        </ul>
    </div>
    
    <main>
        <h1>欢迎访问 ZHAMIT</h1>
        <p>这是测试页面。如果看到导航菜单，说明数据库连接成功。</p>
        <p>导航数据: ${JSON.stringify(navData)}</p>
    </main>
    
    <div class="footer">
        © 2025 ZHAMIT. All rights reserved.
    </div>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}
