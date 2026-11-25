(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('xp_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('xp_' + k, JSON.stringify(v)); } catch (e) {} }
};
const b64 = s => { try { const b = atob(s); return new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))); } catch (e) { return s || ''; } };
const fmt = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
const hhmm = ts => { const d = new Date(ts * 1000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}

/* ---------- Xtream API ---------- */
const TYPES = {
  live:   { cat: 'get_live_categories',   list: 'get_live_streams',   id: 'stream_id', view: 'row' },
  vod:    { cat: 'get_vod_categories',    list: 'get_vod_streams',    id: 'stream_id', view: 'poster' },
  series: { cat: 'get_series_categories', list: 'get_series',         id: 'series_id', view: 'poster' }
};

let creds = store.get('creds', null);
const base = () => creds.server.replace(/\/+$/, '');

async function api(action, params) {
  const q = new URLSearchParams(Object.assign({ username: creds.user, password: creds.pass }, action ? { action } : {}, params || {}));
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(base() + '/player_api.php?' + q, { signal: ctl.signal });
    if (!r.ok) throw new Error('Server answered HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}

const streamUrl = {
  live:   (id, ext) => `${base()}/live/${creds.user}/${creds.pass}/${id}.${ext || 'm3u8'}`,
  vod:    (id, ext) => `${base()}/movie/${creds.user}/${creds.pass}/${id}.${ext || 'mp4'}`,
  series: (id, ext) => `${base()}/series/${creds.user}/${creds.pass}/${id}.${ext || 'mp4'}`
};

/* ---------- state ---------- */
const S = { tab: 'live', cache: {}, catId: 'all', list: [], rendered: 0, query: '' };
const CHUNK = 90;
const favs = () => store.get('favs', { live: [], vod: [], series: [] });
const isFav = (tab, id) => favs()[tab].indexOf(String(id)) >= 0;
function toggleFav(tab, id) {
  const f = favs(); id = String(id);
  const i = f[tab].indexOf(id);
  if (i >= 0) f[tab].splice(i, 1); else f[tab].push(id);
  store.set('favs', f);
  renderCats();
  if (S.catId === 'fav') applyFilter();
  return i < 0;
}

/* ---------- screens / focus ---------- */
const layers = []; // overlays stacked above home
function show(id) { $$('.screen').forEach(s => s.classList.add('hidden')); $('#' + id).classList.remove('hidden'); }
function scopeEl() {
  if (!$('#player').classList.contains('hidden')) return null;
  if (!$('#detail').classList.contains('hidden')) return $('#detail');
  if (!$('#home').classList.contains('hidden')) return $('#home');
  return $('#login');
}
function focusables(root) { return $$('[data-f]', root).filter(e => e.offsetParent !== null && !e.disabled); }
function focusFirst(root, sel) {
  const t = (sel && $(sel, root)) || focusables(root)[0];
  if (t) t.focus();
}

function moveFocus(dir) {
  const root = scopeEl(); if (!root) return;
  const cur = document.activeElement;
  const all = focusables(root);
  if (!cur || all.indexOf(cur) < 0) { if (all[0]) all[0].focus(); return; }

  const inGrid = cur.closest('#grid');
  const inCats = cur.closest('#cats');
  const inTabs = cur.closest('#tabs');

  let candidates = all;
  if (inGrid) {
    if (dir === 'up') {
      candidates = all.filter(e => e.closest('#grid'));
    } else if (dir === 'left') {
      candidates = all.filter(e => e.closest('#grid') || e.closest('#cats'));
    } else if (dir === 'right' || dir === 'down') {
      candidates = all.filter(e => e.closest('#grid'));
    }
  } else if (inCats) {
    if (dir === 'right') {
      candidates = all.filter(e => e.closest('#grid') || e.closest('#cats'));
    } else {
      candidates = all.filter(e => e.closest('#cats') || e.closest('#tabs'));
    }
  }

  // Prevent vertical or random navigation from stepping into the search input and popping up the keyboard
  if (!inTabs && dir !== 'right' && dir !== 'left') {
    candidates = candidates.filter(e => e.id !== 'search');
  }

  const a = cur.getBoundingClientRect(); const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = Infinity;
  for (const e of candidates) {
    if (e === cur) continue;
    const r = e.getBoundingClientRect(); const dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
    let p, o;
    if (dir === 'right') { if (dx <= 5) continue; p = dx; o = Math.abs(dy); }
    else if (dir === 'left') { if (dx >= -5) continue; p = -dx; o = Math.abs(dy); }
    else if (dir === 'down') { if (dy <= 5) continue; p = dy; o = Math.abs(dx); }
    else { if (dy >= -5) continue; p = -dy; o = Math.abs(dx); }
    const sc = p + o * 2.5;
    if (sc < bs) { bs = sc; best = e; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); }
}

/* ---------- login ---------- */
function normServer(s) {
  s = (s || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  return s.replace(/\/(player_api|get)\.php.*$/i, '');
}
async function doLogin(c) {
  creds = c;
  const info = await api();
  if (!info || !info.user_info || Number(info.user_info.auth) !== 1) throw new Error('Login refused – check the details.');
  if (info.user_info.status && info.user_info.status !== 'Active') throw new Error('Account status: ' + info.user_info.status);
  store.set('creds', creds);
  const u = info.user_info; const exp = u.exp_date ? new Date(u.exp_date * 1000).toLocaleDateString() : '∞';
  $('#account').innerHTML = esc(u.username) + '<br>Expires: ' + esc(exp) + ' · Connections: ' + esc(u.active_cons) + '/' + esc(u.max_connections);
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#loginMsg'); msg.style.color = '#8d99b3'; msg.textContent = 'Connecting…';
  try {
    await doLogin({ server: normServer($('#inServer').value), user: $('#inUser').value.trim(), pass: $('#inPass').value });
    S.cache = {};
    enterHome();
  } catch (err) {
    msg.style.color = '#ff7b7b';
    msg.textContent = (err.name === 'AbortError' ? 'Timed out.' : err.message) + ' (If this persists, the server may block browser requests – see README.)';
  }
});

function logout() {
  store.set('creds', null); creds = null; S.cache = {};
  $('#inPass').value = '';
  show('login'); focusFirst($('#login'));
}

/* ---------- home ---------- */
function enterHome() {
  show('home');
  loadTab(S.tab);
}
function setLoading(on) { $('#loading').classList.toggle('hidden', !on); }

async function loadTab(tab, force) {
  S.tab = tab; S.catId = 'all'; S.query = ''; $('#search').value = '';
  $$('#tabs [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const T = TYPES[tab];
  if (force) delete S.cache[tab];
  if (!S.cache[tab]) {
    setLoading(true);
    try {
      const [cats, items] = await Promise.all([api(T.cat), api(T.list)]);
      const counts = {};
      (Array.isArray(items) ? items : []).forEach(i => { counts[i.category_id] = (counts[i.category_id] || 0) + 1; });
      S.cache[tab] = { cats: Array.isArray(cats) ? cats : [], items: Array.isArray(items) ? items : [], counts };
    } catch (err) {
      setLoading(false);
      toast('Could not load: ' + (err.name === 'AbortError' ? 'timed out' : err.message));
      S.cache[tab] = { cats: [], items: [], counts: {} };
    }
    setLoading(false);
  }
  renderCats();
  applyFilter();
  const active = $('#cats .active') || $('#cats button');
  if (active) active.focus();
}

function renderCats() {
  const c = S.cache[S.tab]; const box = $('#cats'); box.innerHTML = '';
  const add = (id, name, n) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.f = ''; b.setAttribute('data-f', ''); b.dataset.cat = id;
    b.innerHTML = esc(name) + (n != null ? '<span class="cnt">' + n + '</span>' : '');
    if (String(id) === String(S.catId)) b.classList.add('active');
    box.appendChild(b);
  };
  add('fav', '★ Favourites', favs()[S.tab].length);
  add('all', 'All', c.items.length);
  c.cats.forEach(k => add(k.category_id, k.category_name, c.counts[k.category_id] || 0));
}

function applyFilter() {
  const c = S.cache[S.tab]; const T = TYPES[S.tab]; const q = S.query.toLowerCase();
  let list = c.items;
  if (S.catId === 'fav') { const f = favs()[S.tab]; list = list.filter(i => f.indexOf(String(i[T.id])) >= 0); }
  else if (S.catId !== 'all') list = list.filter(i => String(i.category_id) === String(S.catId));
  if (q) list = list.filter(i => (i.name || '').toLowerCase().indexOf(q) >= 0);
  S.list = list; S.rendered = 0;
  const g = $('#grid'); g.className = TYPES[S.tab].view; g.innerHTML = ''; g.scrollTop = 0;
  if (!list.length) { g.innerHTML = '<div class="empty">Nothing here.</div>'; return; }
  renderMore();
}

function renderMore() {
  const g = $('#grid'); const T = TYPES[S.tab];
  const end = Math.min(S.list.length, S.rendered + CHUNK);
  const frag = document.createDocumentFragment();
  for (let i = S.rendered; i < end; i++) {
    const it = S.list[i]; const id = it[T.id];
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card'; b.setAttribute('data-f', ''); b.dataset.i = i;
    const img = it.stream_icon || it.cover || '';
    b.innerHTML = '<div class="img"' + (img ? ' style="background-image:url(\'' + esc(img).replace(/'/g, '%27') + '\')"' : '') + '></div><div class="t">' +
      (isFav(S.tab, id) ? '<span class="fav">★ </span>' : '') + esc(it.name) + '</div>';
    frag.appendChild(b);
  }
  g.appendChild(frag); S.rendered = end;
}

$('#grid').addEventListener('focusin', e => {
  const c = e.target.closest('.card'); if (!c) return;
  if (Number(c.dataset.i) >= S.rendered - 12 && S.rendered < S.list.length) renderMore();
});

function activate(el) {
  if (el.dataset.cat != null) { S.catId = el.dataset.cat; $$('#cats button').forEach(b => b.classList.toggle('active', b === el)); applyFilter(); return; }
  if (el.dataset.tab) { loadTab(el.dataset.tab); return; }
  if (el.id === 'btnRefresh') { loadTab(S.tab, true); return; }
  if (el.id === 'btnLogout') { logout(); return; }
  if (el.classList.contains('card')) {
    const it = S.list[Number(el.dataset.i)]; if (!it) return;
    S.lastIdx = Number(el.dataset.i);
    if (S.tab === 'live') playLive(Number(el.dataset.i));
    else openDetail(it);
  }
}

let searchTimer;
const searchEl = $('#search');
// Search stays read-only (no on-screen keyboard) until the user presses OK on it.
function openSearch() {
  searchEl.blur();
  searchEl.readOnly = false;
  searchEl.focus(); // webOS shows the virtual keyboard when an editable input gets focus
}
function closeSearch() {
  searchEl.readOnly = true;
  searchEl.blur();
  searchEl.focus(); // stay highlighted, keyboard closed
}
searchEl.addEventListener('focusout', () => { searchEl.readOnly = true; });
searchEl.addEventListener('click', () => { if (searchEl.readOnly) openSearch(); });
$('#search').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { S.query = e.target.value.trim(); applyFilter(); }, 350);
});

/* ---------- detail (movies / series) ---------- */
async function openDetail(it) {
  const tab = S.tab; const T = TYPES[tab]; const id = it[T.id];
  const d = $('#detail'); d.classList.remove('hidden'); d.innerHTML = '<div class="loading">Loading…</div>';
  let info = {};
  try { 
    info = await api(tab === 'vod' ? 'get_vod_info' : 'get_series_info', tab === 'vod' ? { vod_id: id } : { series_id: id }); 
  }
  catch (e) { 
    d.classList.add('hidden');
    toast('Could not load details: ' + e.message);
    return;
  }
  const i = info.info || {};
  const poster = i.movie_image || i.cover || it.stream_icon || it.cover || '';
  const meta = [i.releasedate || i.releaseDate || it.year, i.genre, i.duration, i.rating ? '★ ' + i.rating : (it.rating ? '★ ' + it.rating : '')].filter(Boolean).join('  ·  ');
  d.innerHTML = '<div class="top"><div class="poster"' + (poster ? ' style="background-image:url(\'' + esc(poster).replace(/'/g, '%27') + '\')"' : '') + '></div>' +
    '<div style="flex:1;min-width:0"><h2>' + esc(it.name) + '</h2><div class="meta">' + esc(meta) + '</div>' +
    '<div class="plot">' + esc(i.plot || i.description || '') + '</div><div class="btns" id="dBtns"></div>' +
    '<div class="btns" id="dSeasons"></div><div class="eps" id="dEps"></div></div></div>';
  const btns = $('#dBtns');
  const mk = (txt, fn, parent, cls) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-f', ''); b.textContent = txt; if (cls) b.className = cls; b.onclick = fn; (parent || btns).appendChild(b); return b; };

  if (tab === 'vod') {
    const ext = (info.movie_data && info.movie_data.container_extension) || it.container_extension || 'mp4';
    const key = 'vod_' + id; const pos = store.get('pos', {})[key];
    mk('▶ Play', () => playVod(streamUrl.vod(id, ext), it.name, key, 0));
    if (pos && pos > 30) mk('⏵ Resume ' + fmt(pos), () => playVod(streamUrl.vod(id, ext), it.name, key, pos));
  } else {
    const eps = info.episodes || {}; const seasons = Object.keys(eps).sort((a, b) => a - b);
    const sBox = $('#dSeasons'); const eBox = $('#dEps');
    const showSeason = s => {
      $$('button', sBox).forEach(b => b.classList.toggle('on', b.dataset.s === s));
      eBox.innerHTML = '';
      const list = eps[s] || [];
      list.forEach((ep, idx) => {
        const key = 'ep_' + ep.id; const pos = store.get('pos', {})[key];
        const title = 'S' + s + 'E' + ep.episode_num + ' – ' + (ep.title || 'Episode') + (pos > 30 ? '   (resume ' + fmt(pos) + ')' : '');
        mk(title, () => {
          const queue = list.map(e => ({ url: streamUrl.series(e.id, e.container_extension), title: it.name + ' – S' + s + 'E' + e.episode_num + ' ' + (e.title || ''), key: 'ep_' + e.id }));
          playVod(queue[idx].url, queue[idx].title, queue[idx].key, pos || 0, queue, idx);
        }, eBox);
      });
    };
    seasons.forEach(s => { const b = mk('Season ' + s, () => { showSeason(s); const f = $('#dEps button'); if (f) f.focus(); }, sBox); b.dataset.s = s; });
    if (seasons.length) showSeason(seasons[0]); else $('#dEps').innerHTML = '<div class="empty">No episodes found.</div>';
  }
  const fb = mk(isFav(tab, id) ? '★ Remove favourite' : '☆ Add favourite', () => {
    const on = toggleFav(tab, id); fb.textContent = on ? '★ Remove favourite' : '☆ Add favourite'; toast(on ? 'Added to favourites' : 'Removed');
  });
  mk('← Back', closeDetail);
  focusFirst(d);
}
function closeDetail() {
  const d = $('#detail'); d.classList.add('hidden'); d.innerHTML = '';
  renderCats(); const f = S.catId === 'fav'; if (f) applyFilter();
  const last = $('#grid .card[data-i="' + (S.lastIdx || 0) + '"]') || $('#grid .card'); if (last) last.focus();
}

/* ---------- player ---------- */
const V = $('#video');
const P = { mode: null, idx: 0, queue: null, qi: 0, key: null, title: '', tried: 0, osdTimer: null, lastSave: 0, epgTimer: null };

function showPlayer() { $('#player').classList.remove('hidden'); if (document.activeElement) document.activeElement.blur(); }
function osd(on) {
  const o = $('#osd'); clearTimeout(P.osdTimer);
  if (on === false) { o.classList.add('hidden'); return; }
  o.classList.remove('hidden');
  P.osdTimer = setTimeout(() => o.classList.add('hidden'), 4500);
}
function setErr(msg) { const e = $('#playerErr'); if (msg) { e.textContent = msg; e.classList.remove('hidden'); } else e.classList.add('hidden'); }

function startSrc(url) {
  setErr(null); $('#spinner').classList.remove('hidden');
  V.pause(); V.removeAttribute('src'); V.load();
  V.src = url;
  V.play().catch(err => {
    console.log("Playback error:", err);
    $('#spinner').classList.add('hidden');
    setErr('Autoplay blocked or stream format unsupported.');
  });
}

function playLive(i) {
  S.lastIdx = i;
  const it = S.list[i]; if (!it) return;
  P.mode = 'live'; P.idx = i; P.tried = 0; P.title = it.name;
  showPlayer();
  $('#osdBar').classList.add('hidden'); $('#osdTitle').textContent = it.name; $('#osdSub').textContent = ''; $('#osdTime').textContent = '';
  P.liveFormats = ['m3u8', 'ts'];
  startSrc(streamUrl.live(it.stream_id, P.liveFormats[0]));
  osd(); loadEpg(it.stream_id);
}
async function loadEpg(id) {
  try {
    const r = await api('get_short_epg', { stream_id: id, limit: 2 });
    const l = (r && r.epg_listings) || [];
    if (P.mode !== 'live' || S.list[P.idx].stream_id !== id) return;
    $('#osdSub').textContent = l.length ? l.map(e => hhmm(e.start_timestamp) + '–' + hhmm(e.stop_timestamp) + ' ' + b64(e.title)).join('     ') : '';
  } catch (e) {}
}
function zap(d) {
  const n = P.idx + d; if (n < 0 || n >= S.list.length) return;
  playLive(n);
}

function playVod(url, title, key, startAt, queue, qi) {
  P.mode = 'vod'; P.key = key; P.title = title; P.queue = queue || null; P.qi = qi || 0; P.start = startAt || 0;
  showPlayer();
  $('#osdBar').classList.remove('hidden'); $('#osdTitle').textContent = title; $('#osdSub').textContent = '';
  startSrc(url); osd();
}
function savePos(force) {
  if (P.mode !== 'vod' || !P.key || !V.duration) return;
  const now = Date.now(); if (!force && now - P.lastSave < 10000) return; P.lastSave = now;
  const pos = store.get('pos', {});
  if (V.currentTime > V.duration - 45) delete pos[P.key]; else pos[P.key] = Math.floor(V.currentTime);
  store.set('pos', pos);
}
function closePlayer() {
  savePos(true);
  V.pause(); V.removeAttribute('src'); V.load();
  clearTimeout(P.osdTimer); osd(false); setErr(null);
  $('#player').classList.add('hidden'); $('#spinner').classList.add('hidden'); P.mode = null;
  const root = scopeEl();
  if (root === $('#detail')) focusFirst(root);
  else { const c = $('#grid .card[data-i="' + (S.lastIdx || 0) + '"]') || $('#grid .card'); (c || $('#cats button')).focus(); }
}

V.addEventListener('loadedmetadata', () => { if (P.mode === 'vod' && P.start > 0) { try { V.currentTime = P.start; } catch (e) {} P.start = 0; } });
V.addEventListener('playing', () => { $('#spinner').classList.add('hidden'); setErr(null); });
V.addEventListener('waiting', () => $('#spinner').classList.remove('hidden'));
V.addEventListener('timeupdate', () => {
  if (P.mode !== 'vod' || !V.duration) return;
  $('#osdFill').style.width = (V.currentTime / V.duration * 100) + '%';
  $('#osdTime').textContent = fmt(V.currentTime) + ' / ' + fmt(V.duration);
  savePos(false);
});
V.addEventListener('ended', () => {
  if (P.mode === 'vod' && P.queue && P.qi + 1 < P.queue.length) {
    savePos(true); const n = P.queue[P.qi + 1]; playVod(n.url, n.title, n.key, 0, P.queue, P.qi + 1);
  } else if (P.mode === 'vod') { const pos = store.get('pos', {}); delete pos[P.key]; store.set('pos', pos); closePlayer(); }
});
V.addEventListener('error', () => {
  $('#spinner').classList.add('hidden');
  if (P.mode === 'live' && P.tried + 1 < P.liveFormats.length) { // fall back from HLS to raw TS
    P.tried++; startSrc(streamUrl.live(S.list[P.idx].stream_id, P.liveFormats[P.tried])); return;
  }
  setErr('Playback failed. The stream may be offline, or the format is not supported by this TV.');
});

function seek(d) {
  if (P.mode !== 'vod' || !V.duration) return;
  V.currentTime = Math.min(V.duration, Math.max(0, V.currentTime + d)); osd();
}
function togglePlay() { if (V.paused) V.play(); else V.pause(); osd(); }

/* ---------- keys ---------- */
const KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 461, ESC: 27, BKSP: 8,
  PLAY: 415, PAUSE: 19, STOP: 413, RW: 412, FF: 417, CHUP: 427, CHDN: 428, PGUP: 33, PGDN: 34, GREEN: 404, YELLOW: 405, BLUE: 406 };

// Colour-button shortcuts (Home screen only)
function goFavourites() {
  S.query = ''; $('#search').value = ''; S.catId = 'fav';
  renderCats(); applyFilter();
  const c = $('#grid .card');
  (c || $('#cats .active') || $('#cats button')).focus();
  toast('Favourites');
}
function goTop() {
  $('#grid').scrollTop = 0; $('#cats').scrollTop = 0;
  const c = $('#grid .card');
  (c || $('#cats .active') || $('#cats button')).focus();
}

document.addEventListener('keydown', e => {
  const k = e.keyCode;
  const playing = !$('#player').classList.contains('hidden');
  const ae = document.activeElement; const inInput = ae && ae.tagName === 'INPUT' && !ae.readOnly;

  if (playing) {
    e.preventDefault();
    if (k === KEY.BACK || k === KEY.ESC || k === KEY.BKSP || k === KEY.STOP) return closePlayer();
    if (k === KEY.PLAY) { V.play(); return osd(); }
    if (k === KEY.PAUSE) { V.pause(); return osd(); }
    if (k === KEY.ENTER) return P.mode === 'vod' ? togglePlay() : osd();
    if (k === KEY.LEFT || k === KEY.RW) return seek(-10);
    if (k === KEY.RIGHT || k === KEY.FF) return seek(10);
    if (P.mode === 'live') {
      if (k === KEY.UP || k === KEY.CHUP || k === KEY.PGUP) return zap(-1);
      if (k === KEY.DOWN || k === KEY.CHDN || k === KEY.PGDN) return zap(1);
    } else if (k === KEY.UP) return seek(60); else if (k === KEY.DOWN) return seek(-60);
    return;
  }

  if ((k === KEY.BACK || k === KEY.ESC) && inInput && ae.id === 'search') {
    e.preventDefault(); closeSearch(); return;
  }

  if (k === KEY.BACK || k === KEY.ESC || (k === KEY.BKSP && !inInput)) {
    e.preventDefault();
    if (!$('#detail').classList.contains('hidden')) return closeDetail();
    if (!$('#home').classList.contains('hidden')) {
      if (ae && ae.closest('#grid')) { const a = $('#cats .active') || $('#cats button'); return a.focus(); }
      if (ae && ae.closest('#cats')) return $('#tabs .active').focus();
      return window.close();
    }
    return window.close();
  }

  if ((k === KEY.BLUE || k === KEY.GREEN) && !inInput && !$('#home').classList.contains('hidden') && $('#detail').classList.contains('hidden')) {
    e.preventDefault();
    if (k === KEY.BLUE) goFavourites(); else goTop();
    return;
  }

  if (k === KEY.YELLOW && ae && ae.classList.contains('card')) {
    const it = S.list[Number(ae.dataset.i)]; const on = toggleFav(S.tab, it[TYPES[S.tab].id]);
    ae.querySelector('.t').innerHTML = (on ? '<span class="fav">★ </span>' : '') + esc(it.name);
    toast(on ? 'Added to favourites' : 'Removed from favourites'); return;
  }

  if (k === KEY.ENTER) {
    if (ae && ae.id === 'search' && ae.readOnly) { e.preventDefault(); openSearch(); return; }
    if (inInput) { if (ae.id === 'search') { clearTimeout(searchTimer); S.query = ae.value.trim(); applyFilter(); ae.blur(); const c = $('#grid .card'); if (c) c.focus(); e.preventDefault(); } return; }
    if (ae && ae.tagName === 'BUTTON') { 
      e.preventDefault(); 
      if (ae.closest('#detail')) ae.click(); 
      else activate(ae); 
    }
    return;
  }

  const dir = { [KEY.LEFT]: 'left', [KEY.RIGHT]: 'right', [KEY.UP]: 'up', [KEY.DOWN]: 'down' }[k];
  if (dir) {
    if (inInput && (dir === 'left' || dir === 'right')) return; // let the caret move
    e.preventDefault(); moveFocus(dir);
  }
});

// Mouse / Magic Remote pointer support
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.type === 'submit' && b.id !== 'btnLogin') return;
  if (b.closest('#detail')) return; // detail buttons use onclick
  activate(b);
});

/* ---------- boot ---------- */
(async function boot() {
  if (creds && creds.server) {
    $('#inServer').value = creds.server; $('#inUser').value = creds.user;
    try { await doLogin(creds); enterHome(); return; } catch (e) { /* fall through to login */ }
  }
  show('login'); focusFirst($('#login'));
})();
})();