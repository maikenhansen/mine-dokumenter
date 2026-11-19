/* Lagring i GitHub for Mine dokumenter.
   Gir programmet det samme grensesnittet som det har i Claude (window.claude.use("db") og use("downloads")),
   men dokumentene lagres som filer i et privat GitHub-arkiv:
     data/<bruker>/<id>.json   egne dokumenter (alle mapper som ikke er delt)
     data/felles/<id>.json     dokumenter i de delte mappene (Felles og Operations), som alle brukerne ser
     settings/<bruker>.json    egne mapper
   Brukerne logger inn med navn og passord. GitHub-nøkkelen som gir tilgang til arkivet, ligger kryptert i config.js,
   én kopi per bruker, låst med brukerens passord. Bare den som kan passordet, får låst opp nøkkelen. */
(() => {
const C = window.MD_CONFIG || {};
const API = "https://api.github.com";
const SHARED = new Set(C.sharedFolders || [C.sharedFolder || "Felles"]);   /* mapper som alle brukerne ser */
const SAVE_DELAY = 3000;                 /* venter 3 sekunder etter siste endring før lagring, så det ikke blir en ny versjon per tastetrykk */
const POLL = 30000;                      /* henter endringer fra de andre brukerne hvert 30. sekund */
let token = null, me = null;
try { const s = JSON.parse(localStorage.getItem("md-login") || "null"); if (s && s.token && s.key) { token = s.token; me = s; } } catch (e) {}

/* ---------- GitHub-kall ---------- */
const enc = s => { const b = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(bin); };
const dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, "")), c => c.charCodeAt(0)));
async function gh(path, opt = {}) {
  const r = await fetch(API + path, {
    method: opt.method || "GET", cache: "no-store",
    headers: Object.assign({Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
      opt.body ? {"Content-Type": "application/json"} : {}),
    body: opt.body ? JSON.stringify(opt.body) : undefined
  });
  if (r.status === 404) return null;
  if (r.status === 401 && readyStarted) { try { localStorage.removeItem("md-login"); } catch (e) {} showLogin("Tilgangen til GitHub er utløpt. Be Maiken lage en ny nøkkel i oppsett.html."); }
  if (!r.ok) { const e = new Error("GitHub svarte " + r.status); e.status = r.status; throw e; }
  return r.status === 204 ? {} : r.json();
}
const cpath = p => "/repos/" + encodeURIComponent(C.owner) + "/" + encodeURIComponent(C.repo) + "/contents/" + p.split("/").map(encodeURIComponent).join("/");
const ref = () => "?ref=" + encodeURIComponent(C.branch || "main");
async function readFile(p) {
  const f = await gh(cpath(p) + ref());
  return f ? {sha: f.sha, data: JSON.parse(dec(f.content))} : null;
}
/* Alle skriveoperasjoner går én om gangen, så GitHub ikke avviser samtidige endringer */
let queue = Promise.resolve();
const serial = fn => (queue = queue.then(fn, fn));
async function writeFile(p, data, sha, msg) {
  const body = {message: msg, content: enc(JSON.stringify(data, null, 1)), branch: C.branch || "main"};
  if (sha) body.sha = sha;
  try { return (await gh(cpath(p), {method: "PUT", body})).content.sha; }
  catch (e) {
    if (e.status !== 409 && e.status !== 422) throw e;
    /* Filen er endret et annet sted siden sist: hent ny versjonskode og lagre på nytt */
    const cur = await gh(cpath(p) + ref());
    if (cur) body.sha = cur.sha; else delete body.sha;
    return (await gh(cpath(p), {method: "PUT", body})).content.sha;
  }
}
async function removeFile(p, sha) {
  if (!sha) { const cur = await gh(cpath(p) + ref()); if (!cur) return; sha = cur.sha; }
  try { await gh(cpath(p), {method: "DELETE", body: {message: "Slettet " + p, sha, branch: C.branch || "main"}}); }
  catch (e) { if (e.status !== 409 && e.status !== 422) throw e; const cur = await gh(cpath(p) + ref()); if (cur) await gh(cpath(p), {method: "DELETE", body: {message: "Slettet " + p, sha: cur.sha, branch: C.branch || "main"}}); }
}

/* ---------- Dokumentene ---------- */
const known = {};      /* id -> {dir, sha, data}: siste kjente versjon i GitHub */
const pending = {};    /* id -> {data, waiters, timer}: endringer som venter på å bli lagret */
const dirFor = d => d && SHARED.has(d.folder) ? "felles" : me.key;
function flush(id) {
  const p = pending[id]; if (!p) return Promise.resolve();
  clearTimeout(p.timer); delete pending[id];
  return serial(async () => {
    try {
      const data = p.data, dir = dirFor(data), old = known[id];
      const path = "data/" + dir + "/" + id + ".json";
      const sha = await writeFile(path, data, old && old.dir === dir ? old.sha : null, "Lagret «" + (data.title || "Uten tittel") + "» (" + me.name + ")");
      if (old && old.dir !== dir) await removeFile("data/" + old.dir + "/" + id + ".json", old.sha);
      known[id] = {dir, sha, data};
      p.waiters.forEach(w => w[0]());
    } catch (e) { p.waiters.forEach(w => w[1](e)); }
  });
}
const flushAll = () => Promise.all(Object.keys(pending).map(flush));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushAll(); });
window.addEventListener("beforeunload", e => { if (Object.keys(pending).length) { flushAll(); e.preventDefault(); e.returnValue = ""; } });

async function listDocs() {
  const out = {};
  for (const dir of [me.key, "felles"]) {
    const list = await gh(cpath("data/" + dir) + ref());
    if (!Array.isArray(list)) continue;
    await Promise.all(list.filter(f => f.type === "file" && f.name.endsWith(".json")).map(async f => {
      const id = f.name.slice(0, -5);
      let k = known[id];
      if (!k || k.sha !== f.sha || k.dir !== dir) {
        const file = await readFile("data/" + dir + "/" + id + ".json"); if (!file) return;
        /* En eldre versjon fra GitHub erstatter ikke en nyere som allerede er lagret herfra */
        if (!k || !(k.data.updated > file.data.updated)) k = known[id] = {dir, sha: file.sha, data: file.data};
      }
      if (!out[id] || (k.data.updated || 0) > (out[id].updated || 0)) out[id] = k.data;
    }));
  }
  Object.keys(known).forEach(id => { if (!out[id] && !pending[id]) delete known[id]; });
  Object.entries(pending).forEach(([id, p]) => { out[id] = p.data; });
  return out;
}

/* ---------- Samme grensesnitt som i Claude ---------- */
const snap = (id, data) => ({id, exists: !!data, data: () => data});
const db = {
  doc(path) {
    const [col, id] = path.split("/");
    if (col === "meta") return {
      async get() { const f = await readFile("settings/" + me.key + ".json"); settingsSha = f && f.sha; return snap(id, f && f.data); },
      set(v) { return serial(async () => { settingsSha = await writeFile("settings/" + me.key + ".json", v, settingsSha, "Mapper (" + me.name + ")"); }); }
    };
    return {
      async get() { const k = known[id]; return snap(id, pending[id] ? pending[id].data : k && k.data); },
      set(v) {
        return new Promise((res, rej) => {
          const p = pending[id] || (pending[id] = {waiters: []});
          p.data = JSON.parse(JSON.stringify(v)); p.waiters.push([res, rej]);
          clearTimeout(p.timer); p.timer = setTimeout(() => flush(id), SAVE_DELAY);
        });
      },
      delete() {
        const p = pending[id]; if (p) { clearTimeout(p.timer); delete pending[id]; p.waiters.forEach(w => w[0]()); }
        return serial(async () => { const k = known[id]; if (k) { await removeFile("data/" + k.dir + "/" + id + ".json", k.sha); delete known[id]; } });
      }
    };
  },
  collection() {
    return {
      onSnapshot(cb, onErr) {
        let failed = false;
        const run = async () => {
          try {
            const all = await listDocs(); failed = false;
            cb({docs: Object.entries(all).map(([id, d]) => snap(id, d))});
          } catch (e) { if (!failed && onErr) onErr(e); failed = true; }
        };
        run();
        const t = setInterval(run, POLL);
        window.addEventListener("focus", run);
        return () => { clearInterval(t); window.removeEventListener("focus", run); };
      }
    };
  }
};
let settingsSha = null;
const downloads = {
  async save({filename, data}) {
    const url = URL.createObjectURL(data), a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return {status: "saved"};
  }
};

/* ---------- Innlogging ---------- */
let readyRes; const ready = new Promise(r => readyRes = r);
window.claude = {use: async name => name === "downloads" ? downloads : name === "db" ? (await ready, db) : null};

/* Låser opp GitHub-nøkkelen med passordet (PBKDF2 + AES-GCM, samme oppskrift som i oppsett.html) */
const ub = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function unlock(u, password) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({name: "PBKDF2", salt: ub(u.salt), iterations: u.iter || 600000, hash: "SHA-256"},
    base, {name: "AES-GCM", length: 256}, false, ["decrypt"]);
  return new TextDecoder().decode(await crypto.subtle.decrypt({name: "AES-GCM", iv: ub(u.iv)}, key, ub(u.data)));
}

const css = document.createElement("style");
css.textContent = `
.ghlogin{position:fixed;inset:0;z-index:100;background:var(--bg,#e9ecef);display:flex;align-items:center;justify-content:center;padding:16px;font-family:var(--ui,system-ui)}
.ghlogin form{background:var(--panel,#fff);color:var(--fg,#1d2329);border:1px solid var(--line,#d3d9df);border-radius:10px;padding:24px;width:min(420px,100%);display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 30px rgba(0,0,0,.12)}
.ghlogin h1{margin:0 0 4px;font-size:24px}
.ghlogin label{display:flex;flex-direction:column;gap:4px;font-size:14px;color:var(--muted,#5b6570)}
.ghlogin input,.ghlogin select{font-size:16px;padding:10px 12px;border:1px solid var(--line,#d3d9df);border-radius:6px;background:var(--bg,#fff);color:var(--fg,#1d2329)}
.ghlogin .keep{flex-direction:row;align-items:center;gap:8px}
.ghlogin button{font-size:16px;padding:10px 14px;border:0;border-radius:6px;background:var(--accent,#2f5d7c);color:#fff;font-weight:600;cursor:pointer}
.ghlogin button:disabled{opacity:.6;cursor:default}
.ghlogin .err{margin:0;color:var(--danger,#a33a2c);min-height:1.4em;font-size:15px}
.ghuser{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--muted,#5b6570)}
.ghuser button{margin-left:auto;border:1px solid var(--line,#d3d9df);background:var(--bg,#fff);color:inherit;border-radius:6px;padding:4px 10px;font-size:14px;cursor:pointer}`;
document.head.appendChild(css);

function showLogin(msg) {
  if (document.querySelector(".ghlogin")) return;
  const users = (C.users || []).filter(u => u.data);
  const box = document.createElement("div"); box.className = "ghlogin";
  box.innerHTML = '<form><h1>Mine dokumenter</h1>' +
    '<label>Bruker<select id="ghUser"></select></label>' +
    '<label>Passord<input type="password" id="ghPw" autocomplete="current-password"></label>' +
    '<label class="keep"><input type="checkbox" id="ghKeep" checked> Husk meg på denne PC-en</label>' +
    '<button type="submit">Logg inn</button><p class="err" id="ghErr"></p></form>';
  document.body.appendChild(box);
  const sel = box.querySelector("#ghUser");
  users.forEach(u => sel.add(new Option(u.name, u.key)));
  try { const last = localStorage.getItem("md-last-user"); if (last && users.some(u => u.key === last)) sel.value = last; } catch (e) {}
  const errEl = box.querySelector("#ghErr");
  errEl.textContent = users.length ? (msg || "") : "Ingen brukere er satt opp ennå. Åpne oppsett.html.";
  box.querySelector("#ghPw").focus();
  box.querySelector("form").addEventListener("submit", async e => {
    e.preventDefault();
    const u = users.find(x => x.key === sel.value), pw = box.querySelector("#ghPw").value;
    if (!u || !pw) return;
    const btn = box.querySelector("button"); btn.disabled = true; errEl.textContent = "Logger inn …";
    let t;
    try { t = await unlock(u, pw); } catch (e2) { errEl.textContent = "Feil passord."; btn.disabled = false; return; }
    token = t; me = {key: u.key, name: u.name, token: t};
    const err = await checkRepo();
    if (err) { errEl.textContent = err; btn.disabled = false; token = null; me = null; return; }
    try {
      localStorage.setItem("md-last-user", u.key);
      if (box.querySelector("#ghKeep").checked) localStorage.setItem("md-login", JSON.stringify(me));
    } catch (e3) {}
    if (readyStarted) { location.reload(); return; }
    box.remove(); start();
  });
}
async function checkRepo() {
  try {
    const r = await gh("/repos/" + encodeURIComponent(C.owner) + "/" + encodeURIComponent(C.repo));
    return r ? null : "Fant ikke dokumentarkivet. Be Maiken sjekke oppsettet.";
  } catch (e) {
    return e.status === 401 ? "Tilgangen til GitHub er utløpt. Be Maiken lage en ny nøkkel i oppsett.html." : "Fikk ikke kontakt med GitHub. Sjekk nettforbindelsen.";
  }
}
let readyStarted = false;
function start() {
  readyStarted = true;
  const head = document.querySelector(".side-head");
  if (head) {
    const b = document.createElement("div"); b.className = "ghuser";
    b.innerHTML = "<span>Logget inn som <strong></strong></span><button type=\"button\">Logg ut</button>";
    b.querySelector("strong").textContent = me.name;
    b.querySelector("button").addEventListener("click", async () => {
      await flushAll();
      try { localStorage.removeItem("md-login"); } catch (e) {}
      location.reload();
    });
    head.appendChild(b);
  }
  readyRes();
}
document.addEventListener("DOMContentLoaded", async () => {
  /* En lagret innlogging brukes bare hvis brukeren fortsatt finnes i config.js */
  if (!me || !(C.users || []).some(u => u.key === me.key && u.data)) { me = null; token = null; showLogin(); return; }
  const err = await checkRepo();
  if (err) { try { localStorage.removeItem("md-login"); } catch (e) {} me = null; token = null; showLogin(err); return; }
  start();
});
})();
