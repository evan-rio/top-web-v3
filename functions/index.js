// functions/index.js - 第一步：只读取数据库，不翻译

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 跳过 API 和静态资源
  if (path.startsWith('/api/') || path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|webp)$/)) {
    return context.next();
  }
  
  // 简单的 HTML 测试
  const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ZHAMIT Test</title>
    <style>
        body { font-family: system-ui; padding: 40px; max-width: 800px; margin: 0 auto; }
        .success { color: green; }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>ZHAMIT 框架测试</h1>
    <div id="result">测试数据库连接...</div>
    
    <script>
        async function testDB() {
            try {
                const res = await fetch('/api/nav');
                const data = await res.json();
                document.getElementById('result').innerHTML = '<span class="success">✅ 数据库连接成功！导航数据: ' + JSON.stringify(data) + '</span>';
            } catch(e) {
                document.getElementById('result').innerHTML = '<span class="error">❌ 数据库连接失败: ' + e.message + '</span>';
            }
        }
        testDB();
    </script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
