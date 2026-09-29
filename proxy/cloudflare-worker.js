// 可选：DeepSeek 转发（只在浏览器直连 api.deepseek.com 被跨域拦截时才需要）
// 部署：Cloudflare 控制台 → Workers → 新建 → 粘贴本文件 → 部署，
// 然后在页面"AI 服务设置"的"接口地址"里填 https://<你的worker>.workers.dev
// 这个转发不保存任何 Key：Key 由用户浏览器带在请求头里，原样转给 DeepSeek。
const ALLOW_ORIGIN = '*';   // 上线时改成你的页面域名，例如 'https://yourname.github.io'

const cors = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    if (req.method !== 'POST' || url.pathname !== '/chat/completions') return new Response('Not found', { status: 404, headers: cors });
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') || '' },
      body: req.body,
    });
    const h = new Headers(upstream.headers);
    Object.entries(cors).forEach(([k, v]) => h.set(k, v));
    return new Response(upstream.body, { status: upstream.status, headers: h });
  },
};
