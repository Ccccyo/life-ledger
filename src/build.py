import re
page = open('page.html', encoding='utf-8').read()
style = open('style.css', encoding='utf-8').read()
data = open('data.js', encoding='utf-8').read() + '\n' + open('evalcases.js', encoding='utf-8').read()
model = open('model.js', encoding='utf-8').read()
app = open('app.js', encoding='utf-8').read()
fonts = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Serif+SC:wght@600;700&display=swap">')
def fill(p, f):
    return (p.replace('@@FONTS@@', f).replace('@@STYLE@@', style).replace('@@DATA@@', data)
             .replace('@@MODEL@@', model).replace('@@APP@@', app))
art = fill(page, fonts)
open('life-ledger.html', 'w', encoding='utf-8').write(art)
# 自托管版：完整文档外壳，不依赖谷歌字体（国内可正常打开）
local = fill(page, '')
cut = local.index('</style>') + len('</style>')
head = local[:cut]
body = local[cut:]
standalone = ('<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  '<meta property="og:title" content="一生账本">\n'
  '<meta property="og:description" content="把一辈子摊开，看清每一笔。">\n'
  '<style>body{margin:0}</style>\n' + head + '\n</head>\n<body>\n' + body + '\n</body>\n</html>\n')
open('index.html', 'w', encoding='utf-8').write(standalone)
print(len(art), len(standalone))
