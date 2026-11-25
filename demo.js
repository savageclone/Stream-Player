/* Demo data layer: replaces the Xtream server with fake, self-contained data.
   Poster/logo images are generated SVGs; video comes from public sample streams. */
(function () {
'use strict';

const MP4 = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
];
const HLS = [
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8'
];

const PALETTES = [['#ff7a59', '#7b2ff7'], ['#00c6ff', '#0072ff'], ['#f7971e', '#d4145a'], ['#43e97b', '#0b6e6e'],
  ['#fa709a', '#6a11cb'], ['#30cfd0', '#330867'], ['#f093fb', '#f5576c'], ['#fddb92', '#d1913c']];
const svgUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/'/g, '%27');
const wrap = (t, n) => { const w = t.split(' '), L = []; let c = ''; w.forEach(x => { if ((c + ' ' + x).trim().length > n) { L.push(c); c = x; } else c = (c + ' ' + x).trim(); }); if (c) L.push(c); return L.slice(0, 4); };
const xml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function poster(title, seed) {
  const p = PALETTES[seed % PALETTES.length];
  const lines = wrap(title.toUpperCase(), 11);
  const text = lines.map((l, i) => `<text x="150" y="${210 - (lines.length - 1) * 22 + i * 44}" font-family="Arial,Helvetica,sans-serif" font-size="38" font-weight="800" fill="#fff" text-anchor="middle">${xml(l)}</text>`).join('');
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs><rect width="300" height="450" fill="url(#g)"/><circle cx="240" cy="70" r="110" fill="#fff" opacity=".08"/><circle cx="40" cy="420" r="140" fill="#000" opacity=".12"/>${text}<text x="150" y="420" font-family="Arial" font-size="18" fill="#fff" opacity=".7" text-anchor="middle">DEMO</text></svg>`);
}
function logo(name, seed) {
  const p = PALETTES[seed % PALETTES.length];
  const ini = name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="168" height="120" viewBox="0 0 168 120"><rect x="14" y="10" width="140" height="100" rx="22" fill="${p[1]}"/><rect x="14" y="10" width="140" height="100" rx="22" fill="${p[0]}" opacity=".45"/><text x="84" y="76" font-family="Arial,Helvetica,sans-serif" font-size="44" font-weight="800" fill="#fff" text-anchor="middle">${xml(ini)}</text></svg>`);
}

/* ---------- catalogue ---------- */
const liveCats = [
  { category_id: '1', category_name: 'News', ch: ['Demo News 24', 'World Report', 'Business Today', 'Morning Live', 'Global Headlines', 'Weather Channel'] },
  { category_id: '2', category_name: 'Sports', ch: ['Sports One', 'Sports Two', 'Football Live', 'Tennis Hub', 'Racing TV', 'Outdoor Sports'] },
  { category_id: '3', category_name: 'Movies', ch: ['Cinema Classics', 'Action Max', 'Comedy Central Demo', 'Drama Plus', 'Sci-Fi Channel'] },
  { category_id: '4', category_name: 'Kids', ch: ['Kids Zone', 'Cartoon Planet', 'Toon Time', 'Little Learners'] },
  { category_id: '5', category_name: 'Music', ch: ['Hits 24', 'Rock Radio TV', 'Chill Beats', 'Classical Hall', 'Jazz Lounge'] },
  { category_id: '6', category_name: 'Documentary', ch: ['Nature Wild', 'History Files', 'Science Today', 'Planet Earth Demo'] }
];
const live = []; let sid = 1000;
liveCats.forEach(c => c.ch.forEach(n => live.push({ num: live.length + 1, name: n, stream_type: 'live', stream_id: sid++, stream_icon: logo(n, sid), category_id: c.category_id })));

const vodCats = [{ category_id: '10', category_name: 'Action' }, { category_id: '11', category_name: 'Comedy' }, { category_id: '12', category_name: 'Drama' }, { category_id: '13', category_name: 'Sci-Fi' }, { category_id: '14', category_name: 'Animation' }];
const vodTitles = {
  10: ['Steel Horizon', 'Last Stand City', 'Rapid Fire', 'Iron Tide', 'Night Pursuit', 'Zero Hour', 'Crimson Run', 'Storm Breaker'],
  11: ['Weekend Plans', 'The Awkward Guest', 'Rent Is Due', 'Lucky Break', 'Office Hours', 'Double Booked', 'Small Town Big Mess'],
  12: ['The Long Road Home', 'Quiet Waters', 'Letters From May', 'Paper Crown', 'Autumn Light', 'The Understudy', 'Held Breath'],
  13: ['Orbit Seven', 'Signal From Europa', 'Neon Parallel', 'The Last Colony', 'Quantum Garden', 'Deep Static'],
  14: ['Big Buck Bunny', 'Sintel', 'Tears of Steel', 'Elephants Dream', 'Moon Rabbit', 'The Paper Fox']
};
const plots = ['A gripping story of courage, loyalty and an impossible choice. This is placeholder text for the demo build.',
  'When everything goes wrong, one unlikely team has to hold it together. Placeholder description used for demonstration only.',
  'A visually stunning journey across worlds, told with humour and heart. Demo content – not a real title.'];
const genres = { 10: 'Action', 11: 'Comedy', 12: 'Drama', 13: 'Sci-Fi', 14: 'Animation' };
const vod = []; let vid = 5000;
vodCats.forEach(c => vodTitles[c.category_id].forEach((n, i) => {
  vod.push({ num: vod.length + 1, name: n, stream_type: 'movie', stream_id: vid, stream_icon: poster(n, vid), rating: (6 + ((vid * 7) % 30) / 10).toFixed(1), category_id: c.category_id, container_extension: 'mp4', year: String(2015 + (vid % 10)) });
  vid++;
}));

const serCats = [{ category_id: '20', category_name: 'Drama Series' }, { category_id: '21', category_name: 'Comedy Series' }, { category_id: '22', category_name: 'Documentary Series' }];
const serTitles = { 20: ['Harbour Lights', 'The Northern Line', 'Blackwood', 'Summit'], 21: ['Flatmates', 'The Break Room', 'Second Chances'], 22: ['Wild Coasts', 'Machines That Changed Us', 'Deep Blue'] };
const series = []; let ssid = 8000;
serCats.forEach(c => serTitles[c.category_id].forEach(n => { series.push({ num: series.length + 1, name: n, series_id: ssid, cover: poster(n, ssid), rating: (6.5 + ((ssid * 3) % 25) / 10).toFixed(1), category_id: c.category_id, year: String(2018 + (ssid % 7)) }); ssid++; }));

const epTitles = ['Pilot', 'New Arrivals', 'The Long Night', 'Crossroads', 'Fallout', 'Homecoming'];
function seriesInfo(id) {
  const s = series.find(x => String(x.series_id) === String(id)) || series[0];
  const episodes = {};
  [1, 2].forEach(season => {
    episodes[season] = epTitles.slice(0, 5).map((t, i) => ({
      id: String(s.series_id * 100 + season * 10 + i), episode_num: i + 1, title: t, container_extension: 'mp4', season
    }));
  });
  return { info: { name: s.name, cover: s.cover, plot: plots[s.series_id % plots.length], genre: 'Series', rating: s.rating, releaseDate: s.year + '-01-01' }, episodes };
}

/* ---------- fake EPG ---------- */
const prog = ['Morning Show', 'Top Stories', 'The Big Match', 'Late Night Talk', 'Documentary Hour', 'Cartoon Block', 'Music Mix', 'Evening Movie'];
function epg(id) {
  const now = Math.floor(Date.now() / 1000), slot = 1800;
  const start = now - (now % slot);
  const mk = k => ({ title: btoa(prog[(Number(id) + k) % prog.length]), start_timestamp: start + k * slot, stop_timestamp: start + (k + 1) * slot });
  return { epg_listings: [mk(0), mk(1)] };
}

/* ---------- API ---------- */
function respond(action, p) {
  p = p || {};
  switch (action) {
    case undefined: case null: case '':
      return { user_info: { username: 'sample data', auth: 1, status: 'Active', exp_date: String(Math.floor(Date.now() / 1000) + 365 * 86400), active_cons: '0', max_connections: '1' }, server_info: { url: 'demo.local' } };
    case 'get_live_categories': return liveCats.map(c => ({ category_id: c.category_id, category_name: c.category_name }));
    case 'get_live_streams': return live;
    case 'get_vod_categories': return vodCats;
    case 'get_vod_streams': return vod;
    case 'get_series_categories': return serCats;
    case 'get_series': return series;
    case 'get_vod_info': {
      const m = vod.find(x => String(x.stream_id) === String(p.vod_id)) || vod[0];
      return { info: { movie_image: m.stream_icon, plot: plots[m.stream_id % plots.length], genre: genres[m.category_id], duration: '1h 3' + (m.stream_id % 10) + 'm', rating: m.rating, releasedate: m.year + '-06-01' }, movie_data: { container_extension: 'mp4' } };
    }
    case 'get_series_info': return seriesInfo(p.series_id);
    case 'get_short_epg': return epg(p.stream_id);
    default: return [];
  }
}

window.DEMO_DATA = {
  api: (action, params) => new Promise(res => setTimeout(() => res(JSON.parse(JSON.stringify(respond(action, params)))), 250)),
  streamUrl: (type, id, ext) => {
    id = Number(id);
    if (type === 'live') return ext === 'ts' ? HLS[id % HLS.length] : HLS[id % HLS.length];
    return MP4[id % MP4.length];
  }
};
})();
