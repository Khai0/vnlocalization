#!/usr/bin/env node
/* VNlocalization — web + trang admin. Không cần cài thư viện.
   Chạy:  node server.js   →  http://localhost:3000/admin/
   Biến môi trường: PORT, HOST (mặc định 127.0.0.1), ADMIN_USER (admin), ADMIN_PASS */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = __dirname, PORT = +process.env.PORT || 3000, HOST = process.env.HOST || '127.0.0.1';
const USER = process.env.ADMIN_USER || 'admin';
const PASS = process.env.ADMIN_PASS || '123456';
const BAK = path.join(ROOT, '.backups');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const PRIVATE = /^(admin(\/|$)|server\.js$|package(-lock)?\.json$|HUONG_DAN)/;
const fails = new Map();

const send = (res, code, body, type = 'text/plain; charset=utf-8', extra = {}) => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(body);
};
const json = (res, code, o) => send(res, code, JSON.stringify(o), 'application/json');

function resolve(rel) {
  let p; try { p = decodeURIComponent(rel); } catch { return null; }
  p = path.posix.normalize('/' + p.replace(/\\/g, '/')).slice(1);
  if (p.split('/').some((s) => s.startsWith('.'))) return null;
  const full = path.join(ROOT, p);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  return { p, full };
}
const editable = (r) => r && /\.(html|css|xml|txt)$/i.test(r.p) && !PRIVATE.test(r.p);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'admin') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (/\.html$/i.test(e.name)) out.push(path.relative(ROOT, f).split(path.sep).join('/'));
  }
  return out;
}

function backup(p, full) {
  if (!fs.existsSync(full)) return;
  const d = path.join(BAK, p.replace(/\//g, '__'));
  fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(full, path.join(d, new Date().toISOString().replace(/[:.]/g, '-') + '.bak'));
  fs.readdirSync(d).sort().slice(0, -30).forEach((f) => fs.unlinkSync(path.join(d, f)));
}
function save(full, data) { const tmp = full + '.tmp'; fs.writeFileSync(tmp, data); fs.renameSync(tmp, full); }

const body = (req, max = 15e6) => new Promise((ok, no) => {
  const c = []; let n = 0;
  req.on('data', (d) => { n += d.length; if (n > max) { no(new Error('Dữ liệu quá lớn')); req.destroy(); } else c.push(d); });
  req.on('end', () => ok(Buffer.concat(c)));
  req.on('error', no);
});

function auth(req, res) {
  const ip = req.socket.remoteAddress, f = fails.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - f.t > 6e5) { f.n = 0; f.t = Date.now(); }
  if (f.n >= 10) { send(res, 429, 'Thử sai quá nhiều lần. Đợi 10 phút.'); return false; }
  const h = req.headers.authorization || '';
  if (h.startsWith('Basic ')) {
    const a = Buffer.from(h.slice(6), 'base64'), b = Buffer.from(USER + ':' + PASS);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  if (h) { f.n++; fails.set(ip, f); }
  send(res, 401, 'Cần đăng nhập', 'text/plain; charset=utf-8', { 'WWW-Authenticate': 'Basic realm="VNlocalization Admin", charset="UTF-8"' });
  return false;
}

function serveFile(res, full, code = 200) {
  try {
    if (fs.statSync(full).isDirectory()) full = path.join(full, 'index.html');
    send(res, code, fs.readFileSync(full), MIME[path.extname(full).toLowerCase()] || 'application/octet-stream');
  } catch { notFound(res); }
}
function notFound(res) {
  const f = path.join(ROOT, '404.html');
  fs.existsSync(f) ? serveFile(res, f, 404) : send(res, 404, 'Not found');
}

async function api(req, res, u, name) {
  const q = u.searchParams, post = req.method === 'POST';
  if (post && req.headers['x-admin'] !== '1') return json(res, 403, { error: 'Forbidden' });

  if (name === 'pages') {
    return json(res, 200, { pages: walk(ROOT).sort(), css: ['assets/theme.css', 'assets/style.css'].filter((f) => fs.existsSync(path.join(ROOT, f))) });
  }
  if (name === 'file') {
    const r = resolve(q.get('path') || '');
    if (!editable(r) || !fs.existsSync(r.full)) return json(res, 404, { error: 'Không tìm thấy file' });
    if (!post) return send(res, 200, fs.readFileSync(r.full, 'utf8'));
    const data = (await body(req)).toString('utf8');
    if (!data.trim()) return json(res, 400, { error: 'Nội dung trống' });
    backup(r.p, r.full); save(r.full, data);
    return json(res, 200, { ok: true });
  }
  if (name === 'backups' || name === 'backup') {
    const r = resolve(q.get('path') || '');
    if (!editable(r)) return json(res, 400, { error: 'Đường dẫn không hợp lệ' });
    const d = path.join(BAK, r.p.replace(/\//g, '__'));
    if (name === 'backups') return json(res, 200, { items: fs.existsSync(d) ? fs.readdirSync(d).sort().reverse() : [] });
    const f = path.join(d, path.basename(q.get('id') || ''));
    return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f, 'utf8')) : json(res, 404, { error: 'Không có bản sao lưu' });
  }
  if (name === 'upload' && post) {
    const n = path.basename(q.get('name') || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    if (!/\.(png|jpe?g|gif|webp|avif|svg|ico)$/.test(n)) return json(res, 400, { error: 'Chỉ nhận file ảnh' });
    const dir = path.join(ROOT, 'assets', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const out = Date.now().toString(36) + '-' + n;
    fs.writeFileSync(path.join(dir, out), await body(req, 10e6));
    return json(res, 200, { url: '/assets/uploads/' + out });
  }
  if (name === 'replace' && post) {
    const { find, replace = '', scope = 'all', apply = false } = JSON.parse((await body(req)).toString('utf8'));
    if (typeof find !== 'string' || find.length < 2) return json(res, 400, { error: 'Chuỗi tìm quá ngắn' });
    let files = walk(ROOT).concat(['sitemap.xml', 'robots.txt'].filter((f) => fs.existsSync(path.join(ROOT, f))));
    if (scope !== 'all') files = files.filter((f) => f.startsWith(scope + '/'));
    const out = []; let total = 0;
    for (const f of files) {
      const full = path.join(ROOT, f), txt = fs.readFileSync(full, 'utf8'), n = txt.split(find).length - 1;
      if (!n) continue;
      out.push({ path: f, count: n }); total += n;
      if (apply) { backup(f, full); save(full, txt.split(find).join(replace)); }
    }
    return json(res, 200, { files: out, total });
  }
  json(res, 404, { error: 'API không tồn tại' });
}

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x'), pn = u.pathname;
    if (pn.startsWith('/api/')) { if (auth(req, res)) await api(req, res, u, pn.slice(5)); return; }
    if (pn === '/admin' || pn.startsWith('/admin/')) {
      if (!auth(req, res)) return;
      if (pn === '/admin') return send(res, 302, '', 'text/plain', { Location: '/admin/' });
      let rel; try { rel = decodeURIComponent(pn.slice(7)); } catch { return notFound(res); }
      return serveFile(res, path.join(ROOT, 'admin', path.posix.normalize('/' + rel)));
    }
    const r = resolve(pn);
    if (!r || PRIVATE.test(r.p)) return notFound(res);
    let full = r.full;
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      if (!pn.endsWith('/')) return send(res, 302, '', 'text/plain', { Location: pn + '/' + u.search });
      full = path.join(full, 'index.html');
    }
    fs.existsSync(full) ? serveFile(res, full) : notFound(res);
  } catch (e) { send(res, 500, String(e.message || e)); }
}).listen(PORT, HOST, () => {
  console.log(`\n  Website : http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
  console.log(`  Admin   : http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/admin/`);
  console.log(`  Tài khoản: ${USER}   Mật khẩu: ${PASS}${process.env.ADMIN_PASS ? '' : '   (ngẫu nhiên — đặt ADMIN_PASS để cố định)'}\n`);
});
