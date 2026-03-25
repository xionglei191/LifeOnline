import os
import re
import sys

book_dir = "/home/xionglei/Project/LifeOnline/vision/book"
tmp_dir = "/home/xionglei/Project/LifeOnline/.tmp_chapters"

os.makedirs(book_dir, exist_ok=True)
os.makedirs(os.path.join(book_dir, "chapters"), exist_ok=True)

chapters_content = []
for i in range(1, 19):
    path = os.path.join(tmp_dir, f"ch{i:02d}.html")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            chapters_content.append(f.read())
    else:
        print(f"Warning: {path} not found")

if not chapters_content:
    print("No chapters found. Exiting.")
    sys.exit(1)

template_start = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>从零开始用大模型开发软件：以 LifeOnline 为蓝本</title>
  <meta name="description" content="面向零基础读者的《从零开始用大模型开发软件》HTML 书稿，结合 LifeOnline 项目讲解软件工程、前后端、开发流程与 AI 辅助实践。" />
  <link rel="stylesheet" href="assets/styles.css" />
</head>
<body>
  <div class="page-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="eyebrow">LIFEONLINE BOOK DRAFT v3.0</div>
        <h1>从零开始开发软件</h1>
        <p class="subtitle">以 <strong>LifeOnline</strong> 为蓝本的入门教材</p>
        <p class="subtitle">全面扩展版：联合认知体机制深度解析与落点指导。</p>
      </div>
      <div class="directory-actions"><a class="directory-button" href="contents.html">返回目录</a></div>
      <nav class="toc">
        <h2>目录</h2>
        <ol>
"""

titles = []
for idx, html in enumerate(chapters_content):
    match = re.search(r'<h2[^>]*>(.*?)</h2>', html)
    title = match.group(1).strip() if match else f"Chapter {idx+1}"
    title = re.sub(r'<[^>]+>', '', title)
    titles.append(title)
    anchor = f"chapter-{idx+1:02d}"
    
    match_id = re.search(r'<section class="chapter" id="([^"]+)">', html)
    if match_id:
        anchor = match_id.group(1)
        
    template_start += f'          <li><a href="#{anchor}">{title}</a></li>\n'

template_start += """        </ol>
      </nav>
    </aside>
    <main class="content">
      <header class="hero">
        <p class="hero-kicker">全生命周期架构启示录</p>
        <h1>未来的开发是：人与 AI 共同编排数字接力棒。</h1>
        <p class="lead">
          本书详尽讲解了如何抛弃玩具项目的浅尝辄止，通过 <strong>LifeOnline</strong> 彻底看清一个拥有灵魂动作、认知对象、断点延续能力的大型联合认知体是如何从 0 到 1 建成的。
        </p>
      </header>
"""

template_end = """
      <footer class="footer-note">
        <p>当前文件：<code>vision/book/index.html</code></p>
      </footer>
    </main>
  </div>
</body>
</html>
"""

body_html = "\n\n".join(chapters_content)
# FIX IMAGE PATHS FOR INDEX.HTML (it's at root so no ../)
body_html = body_html.replace('../assets/images/', 'assets/images/')

with open(os.path.join(book_dir, "index.html"), "w", encoding="utf-8") as f:
    f.write(template_start + body_html + template_end)

for idx, html in enumerate(chapters_content):
    chap_num = idx + 1
    prev_link = f'<a href="chapter-{chap_num-1:02d}.html" class="nav-prev">← 上一章</a>' if chap_num > 1 else ''
    next_link = f'<a href="chapter-{chap_num+1:02d}.html" class="nav-next">下一章 →</a>' if chap_num < len(chapters_content) else ''
    
    chap_template = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{titles[idx]} | 书稿单章</title>
  <link rel="stylesheet" href="../assets/styles.css" />
</head>
<body>
  <div class="page-shell">
    <aside class="sidebar">
      <div class="brand">
        <h1>{titles[idx]}</h1>
        <p class="subtitle">第 {chap_num:02d} 章</p>
      </div>
      <div class="directory-actions">
        <a class="directory-button" href="../contents.html">目录</a>
        <a class="directory-button" href="../index.html">总览页</a>
      </div>
    </aside>
    <main class="content">
      {html}
      <nav class="chapter-nav" style="margin-top: 40px; display: flex; justify-content: space-between;">
        <div style="flex:1;">{prev_link}</div>
        <div style="flex:1; text-align:right;">{next_link}</div>
      </nav>
    </main>
  </div>
</body>
</html>
"""
    with open(os.path.join(book_dir, "chapters", f"chapter-{chap_num:02d}.html"), "w", encoding="utf-8") as f:
        f.write(chap_template)
print("Build successful!")
