"use strict";
// Zapis: backend (Node 18+, no dependencies). Run: node server.js
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = +process.env.PORT || 3000;
const DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const PUB = path.join(__dirname, "public");
fs.mkdirSync(DIR, { recursive: true });

const SF = path.join(DIR, ".secret");
const SECRET = process.env.SECRET || (fs.existsSync(SF) ? fs.readFileSync(SF, "utf8") :
  (() => { const s = crypto.randomBytes(32).toString("hex"); fs.writeFileSync(SF, s, { mode: 0o600 }); return s; })());

const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); } catch (e) { return d; } };
const wr = (f, o) => { const p = path.join(DIR, f); fs.writeFileSync(p + ".tmp", JSON.stringify(o)); fs.renameSync(p + ".tmp", p); };
const users = rd("users.json", {}), slugs = rd("slugs.json", {}), cache = {};
const getS = sid => /^[a-f0-9]{12}$/.test(sid || "") ? (cache[sid] || (cache[sid] = rd("s_" + sid + ".json", null))) : null;
const putS = s => wr("s_" + s.id + ".json", s);

const sign = o => { const p = Buffer.from(JSON.stringify(o)).toString("base64url"); return p + "." + crypto.createHmac("sha256", SECRET).update(p).digest("base64url"); };
const verify = t => {
  try {
    const [p, s] = String(t).split("."); const e = crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
    if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
    const o = JSON.parse(Buffer.from(p, "base64url")); return o.exp > Date.now() ? o : null;
  } catch (e) { return null; }
};
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

const hits = {};
const ok = (ip, k, max) => { const key = k + ip, t = Date.now(), a = (hits[key] = (hits[key] || []).filter(x => t - x < 6e5)); a.push(t); return a.length <= max; };
const send = (res, code, o) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(o)); };
const body = req => new Promise((res, rej) => {
  let b = "", n = 0;
  req.on("data", c => { n += c.length; if (n > 2e6) { rej(new Error("big")); req.destroy(); } else b += c; });
  req.on("end", () => { try { res(b ? JSON.parse(b) : {}); } catch (e) { rej(e); } });
});
const file = (res, name) => {
  try { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }); res.end(fs.readFileSync(path.join(PUB, name))); }
  catch (e) { res.writeHead(404); res.end("Not found"); }
};

const toM = t => { const [h, m] = String(t).split(":"); return +h * 60 + +m; };
const toT = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const dur = (s, id) => (s.state.services.find(x => x.id == id) || { min: 30 }).min;
function free(s, st, date, start, d) {
  const f = s.state.staff.find(x => x.id == st);
  if (!f || start < toM(f.from) || start + d > toM(f.to)) return false;
  return !s.state.appts.some(a => a.staff == st && a.date == date && a.status != "cancel" && toM(a.time) < start + d && start < toM(a.time) + dur(s, a.service));
}
const slug = n => (String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "salon") + "-" + crypto.randomBytes(2).toString("hex");
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today() && d <= new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
const clean = (s, n) => String(s || "").trim().slice(0, n);

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"), p = u.pathname;
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method === "GET" && p === "/") return file(res, "site.html");
    if (req.method === "GET" && (p === "/app" || p === "/app/")) return file(res, "index.html");
    if (req.method === "GET" && /^\/b\/[\w-]+$/.test(p)) return file(res, "book.html");
    if (!p.startsWith("/api/")) return send(res, 404, { error: "not_found" });

    if (req.method === "POST" && (p === "/api/register" || p === "/api/login")) {
      if (!ok(ip, "auth", 30)) return send(res, 429, { message: "Слишком много попыток. Подождите." });
      const b = await body(req), email = clean(b.email, 120).toLowerCase(), pw = String(b.password || "");
      if (p === "/api/register") {
        const name = clean(b.salon, 60);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { message: "Неверный email" });
        if (pw.length < 8) return send(res, 400, { message: "Пароль: минимум 8 символов" });
        if (name.length < 2) return send(res, 400, { message: "Введите название салона" });
        if (users[email]) return send(res, 409, { message: "Этот email уже зарегистрирован" });
        const id = crypto.randomBytes(6).toString("hex"), sl = slug(name), salt = crypto.randomBytes(16).toString("hex");
        const s = { id, slug: sl, name, v: 1, state: { staff: [], services: [], clients: [], appts: [] } };
        cache[id] = s; putS(s); slugs[sl] = id; wr("slugs.json", slugs);
        users[email] = { salt, hash: hash(pw, salt), sid: id }; wr("users.json", users);
        return send(res, 200, { token: sign({ sid: id, exp: Date.now() + 30 * 864e5 }) });
      }
      const usr = users[email];
      if (!usr || !same(usr.hash, hash(pw, usr.salt))) return send(res, 401, { message: "Неверный email или пароль" });
      return send(res, 200, { token: sign({ sid: usr.sid, exp: Date.now() + 30 * 864e5 }) });
    }

    if (p === "/api/state") {
      const o = verify((req.headers.authorization || "").replace("Bearer ", "")), s = o && getS(o.sid);
      if (!s) return send(res, 401, { message: "auth" });
      if (req.method === "GET") return u.searchParams.get("since") == s.v ? send(res, 200, { same: true }) : send(res, 200, { state: s.state, v: s.v, slug: s.slug, name: s.name });
      if (req.method === "PUT") {
        const b = await body(req), st = b.state;
        if (!st || typeof st !== "object" || !["staff", "services", "clients", "appts"].every(k => Array.isArray(st[k]))) return send(res, 400, { message: "bad state" });
        if (b.v !== s.v) return send(res, 409, { state: s.state, v: s.v });
        s.state = st; s.v++; putS(s); return send(res, 200, { v: s.v });
      }
    }

    const m = p.match(/^\/api\/public\/([\w-]+)(?:\/(slots|book))?$/);
    if (m) {
      const s = getS(slugs[m[1]]); if (!s) return send(res, 404, { message: "Салон не найден" });
      if (req.method === "GET" && !m[2]) return send(res, 200, {
        name: s.name,
        services: s.state.services.map(({ id, name, price, min, cat }) => ({ id, name, price, min, cat })),
        staff: s.state.staff.map(({ id, name, role }) => ({ id, name, role }))
      });
      if (req.method === "GET" && m[2] === "slots") {
        const date = u.searchParams.get("date"), svc = +u.searchParams.get("service"), want = +u.searchParams.get("staff") || 0;
        const sv = s.state.services.find(x => x.id === svc);
        if (!sv || !validDate(date)) return send(res, 400, { message: "bad params" });
        const now = new Date(), nm = date === today() ? now.getHours() * 60 + now.getMinutes() + 30 : 0, out = [];
        for (let t = 8 * 60; t < 21 * 60; t += 30) {
          if (t < nm) continue;
          const st = (want ? [want] : s.state.staff.map(x => x.id)).find(id => free(s, id, date, t, sv.min));
          if (st) out.push({ t: toT(t), staff: st });
        }
        return send(res, 200, { slots: out });
      }
      if (req.method === "POST" && m[2] === "book") {
        if (!ok(ip, "book", 20)) return send(res, 429, { message: "Слишком много запросов" });
        const b = await body(req), name = clean(b.name, 60), phone = clean(b.phone, 20), svc = +b.service, st = +b.staff, date = b.date, t = toM(b.time);
        const sv = s.state.services.find(x => x.id === svc);
        if (!sv || !validDate(date) || name.length < 2 || !/^[+\d\s()-]{7,20}$/.test(phone) || !(t >= 0)) return send(res, 400, { message: "Проверьте введённые данные" });
        if (!free(s, st, date, t, sv.min)) return send(res, 409, { message: "Это время уже занято. Выберите другое." });
        const dg = phone.replace(/\D/g, "");
        let c = s.state.clients.find(x => String(x.phone).replace(/\D/g, "") === dg);
        if (!c) { c = { id: Math.max(0, ...s.state.clients.map(x => x.id)) + 1, name, phone, note: "" }; s.state.clients.push(c); }
        s.state.appts.push({ id: Math.max(0, ...s.state.appts.map(x => x.id)) + 1, date, time: toT(t), staff: st, client: c.id, service: svc, status: "wait", comment: "Онлайн-запись" });
        s.v++; putS(s); return send(res, 200, { ok: true });
      }
    }
    send(res, 404, { error: "not_found" });
  } catch (e) { send(res, 400, { message: "Ошибка запроса" }); }
}).listen(PORT, () => console.log("Zapis server: http://localhost:" + PORT));
