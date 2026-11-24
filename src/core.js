/* Análisis Desviaciones — lógica central (sin interfaz).
   Funciona en el navegador (window.Core) y en Node (module.exports). */
(function (root) {
'use strict';
const Core = {};
const DAY = 86400000;

/* ---------- utilidades ---------- */
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
  return isFinite(n) ? n : 0;
}
function str(v) { return v == null ? '' : String(v).trim(); }
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function parseISO(s) { const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
function diffDays(a, b) { return Math.round((midnight(a) - midnight(b)) / DAY); }
/* Fechas de Retail Link: 'MM/DD/YYYY', 'MM-DD-YYYY', serial de Excel o Date */
function parseDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return midnight(v);
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * DAY)); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
Object.assign(Core, { num, str, ymd, parseISO, addDays, diffDays, parseDate, midnight });

/* ---------- calendario Walmart ----------
   Semana 1 = último sábado en o antes del 1 de febrero. Semanas sáb–vie. */
function fyStart(y, ov) {
  if (ov && ov[y]) { const d = parseISO(ov[y]); if (d) return d; }
  const f = new Date(y, 1, 1);
  const back = (f.getDay() - 6 + 7) % 7;
  return addDays(f, -back);
}
function weekInfo(date, ov) {
  const dt = midnight(date);
  let y = dt.getFullYear() + 1;
  while (fyStart(y, ov) > dt) y--;
  const s = fyStart(y, ov);
  const wk = Math.floor(diffDays(dt, s) / 7) + 1;
  const start = addDays(s, (wk - 1) * 7);
  return { fy: y, wk, label: y * 100 + wk, start, end: addDays(start, 6) };
}
function weekByLabel(label, ov) {
  const y = Math.floor(label / 100), w = label % 100;
  return weekInfo(addDays(fyStart(y, ov), (w - 1) * 7), ov);
}
function weekAdd(label, n, ov) { return weekInfo(addDays(weekByLabel(label, ov).start, 7 * n), ov).label; }
Object.assign(Core, { fyStart, weekInfo, weekByLabel, weekAdd });

/* ---------- eventos de temporada ---------- */
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
    f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
}
function eventRange(ev, y) {
  if (ev.tipo === 'cuaresma') { const e = easter(y); return [addDays(e, -46), addDays(e, -4)]; }
  if (ev.tipo === 'semanasanta') { const e = easter(y); return [addDays(e, -7), addDays(e, 0)]; }
  const d = new Date(y, (ev.mes || 1) - 1, ev.dia || 1); return [d, d];
}
/* devuelve {pct, nombres[]} del evento más fuerte que toca la semana */
function weekUplift(label, events, ov) {
  const w = weekByLabel(label, ov); let pct = 0; const nombres = [];
  for (const ev of events || []) {
    if (ev.activo === false) continue;
    for (const y of new Set([w.start.getFullYear(), w.end.getFullYear()])) {
      const [a, b] = eventRange(ev, y);
      if (a <= w.end && b >= w.start) { nombres.push(ev.nombre); pct = Math.max(pct, num(ev.pct) / 100); }
    }
  }
  return { pct, nombres };
}
Object.assign(Core, { easter, eventRange, weekUplift });

/* ---------- parámetros por defecto ---------- */
Core.defaultParams = function () {
  return {
    version: 1,
    general: {
      frObj: { 37: 95, 33: 95 }, diasInv: { 37: 4, 33: 5 }, leadTime: { 37: 1, 33: 3 },
      diasSeguridad: { 37: 1, 33: 1 }, sesgoSemanas: 3, desvMinPct: 20, desvMinU: 5,
      vidaUtil: 21, horizonteRojo: 7, devAltaPct: 10, frBajoPts: 10, diasFallback: [1, 4],
      cancelCedi: 4
    },
    fyOverrides: {},
    eventos: [
      { id: 'navidad', nombre: 'Navidad', tipo: 'fecha', mes: 12, dia: 25, pct: 40, activo: true },
      { id: 'cuaresma', nombre: 'Cuaresma', tipo: 'cuaresma', pct: 15, activo: true },
      { id: 'santa', nombre: 'Semana Santa', tipo: 'semanasanta', pct: 25, activo: true },
      { id: 'madre', nombre: 'Día de la Madre', tipo: 'fecha', mes: 5, dia: 10, pct: 10, activo: true },
      { id: 'indep', nombre: 'Independencia', tipo: 'fecha', mes: 9, dia: 15, pct: 10, activo: true },
      { id: 'nino', nombre: 'Día del Niño', tipo: 'fecha', mes: 10, dia: 1, pct: 5, activo: true },
      { id: 'santos', nombre: 'Todos los Santos', tipo: 'fecha', mes: 11, dia: 1, pct: 10, activo: true }
    ],
    poEvents: { 'POS REPLEN': 'auto', 'ANULADA': 'otra', 'APERT_A': 'otra' }, // resto TDMANUAL* = manual Walmart
    items: {},   // clave -> {...}
    stores: {},  // tienda -> overrides {offset, estado, type, vigencia}
    vendor: { vndl1: '240502', nombreDirecta: 'PANIFICADORA AMERICANA', nombreCedi: 'PANIFICADORA AMERICANA S A', base9: '24050281' }
  };
};
/* clasificación de un PO Event */
Core.poClass = function (ev, params) {
  const m = (params && params.poEvents) || {};
  if (m[ev]) return m[ev];
  if (/^TDMANUAL/i.test(ev)) return 'manualWalmart';
  return 'otra';
};

/* ---------- lectura de reportes Retail Link ----------
   rows = arreglo de filas (sheet_to_json header:1). */
function headerRow(rows, name) {
  for (let i = 0; i < Math.min(rows.length, 80); i++) {
    const r = rows[i] || [];
    for (let j = 0; j < r.length; j++) if (str(r[j]) === name) return i;
  }
  return -1;
}
function colIndex(hdr) { const m = {}; (hdr || []).forEach((c, i) => { const k = str(c); if (k && m[k] === undefined) m[k] = i; }); return m; }
function textLines(rows, n) { return rows.slice(0, n || 40).map(r => (r || []).filter(c => c != null && c !== '').join(' ')).filter(Boolean); }
function requested(rows) {
  for (const l of textLines(rows, 40)) {
    const m = l.match(/Requested[^:]*:\s*\([^)]*\)\s*(\d{4}) (\d{2}) (\d{2}), (\d{2}):(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }
  return null;
}
/* identifica el reporte por sus columnas */
Core.detectReport = function (rows) {
  const h = headerRow(rows, 'Store Nbr');
  if (h < 0) {
    const t = textLines(rows, 5).join(' ');
    if (/ITEM NBR/i.test(t) && /CLAVE/i.test(t)) return 'items';
    return null;
  }
  const c = colIndex(rows[h]);
  if (c['Sat Qty'] !== undefined) return 'venta';
  if (c['DEV TOTAL'] !== undefined || c['Total Customer Item Return'] !== undefined) return 'devoluciones';
  if (c['Vt DIARIA PROM'] !== undefined) return 'instock';
  if (c['Week 01 Forecast'] !== undefined && c['Prime Item Nbr'] !== undefined) return 'fcst';
  if (c['Curr Str On Order Qty'] !== undefined) return 'dss';
  if (c['PO Number'] !== undefined) return 'fr';
  return null;
};
function body(rows, h) { return rows.slice(h + 1).filter(r => r && num(r[0]) !== 0 || (r && typeof r[0] === 'string' && r[0].trim() === 'GT')); }
function dataRows(rows, h, c) {
  const si = c['Store Nbr'];
  return rows.slice(h + 1).filter(r => r && num(r[si]) > 0);
}

Core.parseVenta = function (rows, ov) {
  const h = headerRow(rows, 'Store Nbr'), c = colIndex(rows[h]);
  const req = requested(rows);
  const wk = weekInfo(addDays(req || new Date(), -7), ov);
  const days = ['Sat Qty', 'Sun Qty', 'Mon Qty', 'Tue Qty', 'Wed Qty', 'Thu Qty', 'Fri Qty'];
  const out = dataRows(rows, h, c).map(r => ({
    s: num(r[c['Store Nbr']]), i: num(r[c['Item Nbr']]), t: num(r[c['Item Type']]), seq: num(r[c['Vendor Sequence Nbr']]),
    name: str(r[c['Store Name']]), desc: str(r[c['Item Desc 1']]),
    oh: num(r[c['Curr Str On Hand Qty']]), pos: num(r[c['POS Qty']]), vc: num(r[c['Str VC Qty']]),
    it: num(r[c['Curr Str In Transit Qty']]), d: days.map(k => num(r[c[k]])), inst: num(r[c['Curr Instock %']])
  }));
  return { kind: 'venta', requested: req ? req.toISOString() : null, week: wk.label, rows: out };
};
Core.parseDevoluciones = function (rows, ov) {
  const h = headerRow(rows, 'Store Nbr'), c = colIndex(rows[h]);
  const req = requested(rows);
  const wk = weekInfo(addDays(req || new Date(), -7), ov);
  const out = dataRows(rows, h, c).map(r => ({
    s: num(r[c['Store Nbr']]), i: num(r[c['Item Nbr']]),
    vc: num(r[c['Str VC Qty']]), cr: num(r[c['Total Customer Item Return']]),
    dev: c['DEV TOTAL'] !== undefined ? num(r[c['DEV TOTAL']]) : num(r[c['Str VC Qty']]) + num(r[c['Total Customer Item Return']])
  }));
  return { kind: 'devoluciones', requested: req ? req.toISOString() : null, week: wk.label, rows: out };
};
Core.parseInstock = function (rows) {
  const h = headerRow(rows, 'Store Nbr'), c = colIndex(rows[h]);
  const req = requested(rows);
  let dias = 35;
  const rng = textLines(rows, 30).join(' ').match(/(\d{2})-(\d{2})-(\d{4}) and (\d{2})-(\d{2})-(\d{4})/);
  let desde = null, hasta = null;
  if (rng) { desde = new Date(+rng[3], +rng[1] - 1, +rng[2]); hasta = new Date(+rng[6], +rng[4] - 1, +rng[5]); dias = diffDays(hasta, desde) + 1; }
  const out = dataRows(rows, h, c).map(r => ({
    s: num(r[c['Store Nbr']]), i: num(r[c['Item Nbr']]), pos: num(r[c['POS Qty']]), vc: num(r[c['Str VC Qty']]),
    oh: num(r[c['Curr Str On Hand Qty']]), vd: num(r[c['POS Qty']]) / dias
  }));
  return { kind: 'instock', requested: req ? req.toISOString() : null, desde: desde && ymd(desde), hasta: hasta && ymd(hasta), dias, rows: out };
};
/* FCST rodante: "Week NN" = la próxima semana fiscal NN */
Core.parseFcst = function (rows, ov) {
  const h = headerRow(rows, 'Store Nbr'), c = colIndex(rows[h]);
  const req = requested(rows) || new Date();
  const cur = weekInfo(req, ov);
  const cols = [];
  for (let n = 1; n <= 53; n++) {
    const k = 'Week ' + String(n).padStart(2, '0') + ' Forecast';
    if (c[k] === undefined) continue;
    const label = (n >= cur.wk ? cur.fy : cur.fy + 1) * 100 + n;
    const ahead = diffDays(weekByLabel(label, ov).start, cur.start) / 7;
    if (ahead >= 0 && ahead <= 14) cols.push([c[k], label]);
  }
  const out = dataRows(rows, h, c).map(r => {
    const w = {}; for (const [ci, label] of cols) w[label] = Math.round(num(r[ci]) * 100) / 100;
    return { s: num(r[c['Store Nbr']]), i: num(r[c['Prime Item Nbr']]), w };
  });
  return { kind: 'fcst', requested: req.toISOString(), week: cur.label, weeks: cols.map(x => x[1]).sort(), rows: out };
};
Core.parseDss = function (rows) {
  const h = headerRow(rows, 'Store Nbr'), c = colIndex(rows[h]);
  const req = requested(rows);
  const out = dataRows(rows, h, c).map(r => ({
    s: num(r[c['Store Nbr']]), i: num(r[c['Item Nbr']]), t: num(r[c['Item Type']]), seq: num(r[c['Vendor Sequence Nbr']]),
    name: str(r[c['Store Name']]), city: str(r[c['City']]), open: (parseDate(r[c['Open Date']]) ? ymd(parseDate(r[c['Open Date']])) : null),
    status: str(r[c['Item Status']]), desc: str(r[c['Item Desc 1']]), vnpk: num(r[c['VNPK Qty']]) || 1,
    oh: num(r[c['Curr Str On Hand Qty']]), it: num(r[c['Curr Str In Transit Qty']]),
    iw: num(r[c['Curr Str In Whse Qty']]), oo: num(r[c['Curr Str On Order Qty']])
  }));
  return { kind: 'dss', requested: req ? req.toISOString() : null, rows: out };
};
/* Fill Rate por combinación (pestaña DSS del archivo FR SMW yyyyww) → resumen compacto */
Core.parseFr = function (rows, week, params) {
  const h = headerRow(rows, 'Store Nbr'), c = colIndex(rows[h]);
  const combos = {}, stores = {}, manual = [], eventos = {};
  for (const r of dataRows(rows, h, c)) {
    const s = num(r[c['Store Nbr']]), i = num(r[c['Item Nbr']]), t = num(r[c['Item Type']]);
    const ev = str(r[c['PO Event']]), cls = Core.poClass(ev, params);
    const ord = num(r[c['Total Eaches Str Ordered']]), rec = num(r[c['Total Eaches Str Received']]);
    const ca = parseDate(r[c['PO Cancel Date']]), cr = parseDate(r[c['PO Create Date']]);
    const e = eventos[ev] || (eventos[ev] = { cls, t: {}, });
    const et = e.t[t] || (e.t[t] = { ord: 0, rec: 0, n: 0 }); et.ord += ord; et.rec += rec; et.n++;
    if (cls === 'otra') continue;
    const k = s + '|' + i, x = combos[k] || (combos[k] = { oa: 0, ra: 0, om: 0, rm: 0 });
    if (cls === 'auto') {
      x.oa += ord; x.ra += rec;
      if (ca) { const st = stores[s] || (stores[s] = { t, ca: {}, lt: {} }); st.ca[ca.getDay()] = 1; if (cr) { const lt = diffDays(ca, cr); st.lt[lt] = (st.lt[lt] || 0) + 1; } }
    } else {
      x.om += ord; x.rm += rec;
      manual.push({ s, i, ev, ca: ca && ymd(ca), ord, rec });
    }
  }
  return { kind: 'fr', week, combos, stores, manual, eventos };
};

/* ---------- maestros ---------- */
/* Data Item y Tienda: hojas ITEM_Data y STR_Data */
Core.parseItemData = function (rows) {
  const h = headerRow(rows, 'ITEM NBR'), c = colIndex(rows[h]);
  const items = {};
  for (const r of rows.slice(h + 1)) {
    const nbr = num(r[c['ITEM NBR']]); if (!nbr) continue;
    const clave = str(r[c['CLAVE']]).replace(/\s*CD$/i, '');
    const t = num(r[c['TYPE']]);
    const it = items[clave] || (items[clave] = {
      clave, cid: num(r[c['CID']]), ean: str(r[c['EAN13']]), desc: str(r[c['DESCRIPCION']]),
      itemD: null, itemC: null, seqC: null, codigoOC: clave.replace(/^\d+(?=[A-Z])/i, ''), descOC: str(r[c['DESCRIPCION']]),
      vida: null, vnpk: 1, activo: true
    });
    if (t === 33) it.itemC = nbr; else it.itemD = nbr;
  }
  return items;
};
Core.parseStrData = function (rows) {
  const h = headerRow(rows, 'STORE NBR'), c = colIndex(rows[h]);
  const st = {};
  for (const r of rows.slice(h + 1)) {
    const s = num(r[c['STORE NBR']]); if (!s) continue;
    st[s] = { s, canal: str(r[c['CANAL']]), type: num(r[c['TYPE']]) || null, formato: str(r[c['FORMATO']]), nombre: str(r[c['NOMBRE DE TIENDA']]), gln: str(r[c['GLN']]) };
  }
  return st;
};
Core.parseFrecuencias = function (rows) {
  const h = headerRow(rows, 'TIENDA'), c = colIndex(rows[h]);
  const dias = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];
  const out = {};
  for (const r of rows.slice(h + 1)) {
    const s = num(r[c['TIENDA']]); if (!s) continue;
    // índice JS getDay(): dom=0 … sáb=6 ; columnas lun..dom
    const d = [0, 0, 0, 0, 0, 0, 0];
    dias.forEach((k, j) => { if (num(r[c[k]]) > 0) d[(j + 1) % 7] = 1; });
    out[s] = { s, type: num(r[c['TYPE']]), nombre: str(r[c['NOMBRE']]), formato: str(r[c['FORMATO']]), vendedor: str(r[c['VENDEDOR']]), dias: d };
  }
  return out;
};

/* ---------- análisis ---------- */
const FORMATO_OC = { despensa: 'DISCOUNT', 'despensa familiar': 'DISCOUNT', maxi: 'BODEGA', maxidespensa: 'BODEGA', paiz: 'SUPERMARKET', walmart: 'HYPERMARKET' };
Core.formatoOC = function (f) { return FORMATO_OC[str(f).toLowerCase()] || str(f).toUpperCase(); };
const DOW_ORDER = [6, 0, 1, 2, 3, 4, 5]; // sáb..vie → getDay
const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
Core.DIA = DIA;

/*
 data = { masters:{items, stores, freq}, params, dss, fcstSnaps:[...], venta:{label:parsed}, dev:{label:parsed}, instock, fr:{label:summary}, today:Date }
*/
Core.analyze = function (data) {
  const P = data.params, G = P.general, ov = P.fyOverrides;
  const items = data.masters.items, storesM = data.masters.stores || {}, freq = data.masters.freq || {};
  const warnings = [];
  const t0 = data.dss && data.dss.requested ? midnight(new Date(data.dss.requested)) : midnight(data.today || new Date());
  const cur = weekInfo(t0, ov);

  /* item nbr → clave / canal */
  const byItem = {};
  for (const k in items) {
    const it = items[k];
    if (it.itemD) byItem[it.itemD] = { clave: k, t: 37 };
    if (it.itemC) byItem[it.itemC] = { clave: k, t: 33 };
  }
  const storeType = s => {
    const so = P.stores[s] || {};
    if (so.type && (!so.vigencia || (parseISO(so.vigencia) || t0) <= t0)) return +so.type;
    if (storesM[s] && storesM[s].type) return storesM[s].type;
    if (freq[s] && freq[s].type) return freq[s].type;
    return null;
  };
  const keyOf = (s, i) => { const b = byItem[i]; return b ? s + '|' + b.clave : null; };

  /* semanas de venta (más reciente primero) */
  const ventaLabels = Object.keys(data.venta || {}).map(Number).filter(l => l < cur.label).sort((a, b) => b - a);
  const hist = {}; // key -> {label:{pos,d,corr,oh,inst}}
  const dowTot = { 37: [0, 0, 0, 0, 0, 0, 0], 33: [0, 0, 0, 0, 0, 0, 0] };
  ventaLabels.forEach((L, idx) => {
    for (const r of data.venta[L].rows) {
      const k = keyOf(r.s, r.i); if (!k) continue;
      const h = hist[k] || (hist[k] = {});
      const x = h[L] || (h[L] = { pos: 0, d: [0, 0, 0, 0, 0, 0, 0], vc: 0 });
      x.pos += r.pos; r.d.forEach((v, j) => x.d[j] += v); x.vc += r.vc;
      if (idx < 4) { const tt = storeType(r.s) || r.t; (dowTot[tt] || dowTot[37]).forEach((_, j) => (dowTot[tt] || dowTot[37])[j] += r.d[j]); }
    }
  });
  const share = {};
  for (const t of [37, 33]) {
    const s = dowTot[t].reduce((a, b) => a + b, 0);
    const sh = [0, 0, 0, 0, 0, 0, 0];
    DOW_ORDER.forEach((gd, j) => { sh[gd] = s > 0 ? dowTot[t][j] / s : 1 / 7; });
    share[t] = sh;
  }
  /* devoluciones por key y semana */
  const devK = {};
  for (const L in data.dev || {}) {
    for (const r of data.dev[L].rows) { const k = keyOf(r.s, r.i); if (!k) continue; (devK[k] || (devK[k] = {}))[L] = ((devK[k] || {})[L] || 0) + r.dev; }
  }
  /* instock 35 días */
  const ins = {};
  if (data.instock) for (const r of data.instock.rows) { const k = keyOf(r.s, r.i); if (!k) continue; const x = ins[k] || (ins[k] = { vd: 0, vc: 0, pos: 0 }); x.vd += r.vd; x.vc += r.vc; x.pos += r.pos; }
  /* FCST: último snapshot y snapshots para medir sesgo */
  const snaps = (data.fcstSnaps || []).slice().sort((a, b) => a.requested < b.requested ? -1 : 1);
  const lastSnap = snaps[snaps.length - 1];
  const snapIdx = snaps.map(sn => { const m = {}; for (const r of sn.rows) { const k = keyOf(r.s, r.i); if (!k) continue; const x = m[k] || (m[k] = {}); for (const w in r.w) x[w] = (x[w] || 0) + r.w[w]; } return { req: new Date(sn.requested), m }; });
  const fcstNow = snapIdx.length ? snapIdx[snapIdx.length - 1].m : {};
  /* pronóstico vigente para una semana pasada: último snapshot tomado antes de que terminara */
  function fcstAsOf(k, L) {
    const w = weekByLabel(L, ov);
    for (let j = snapIdx.length - 1; j >= 0; j--) {
      const sn = snapIdx[j];
      if (sn.req <= addDays(w.end, 1) && sn.req >= addDays(w.start, -10) && sn.m[k] && sn.m[k][L] != null) return sn.m[k][L];
    }
    return null;
  }
  /* fill rate por key (últimas 4 semanas) */
  const frLabels = Object.keys(data.fr || {}).map(Number).sort((a, b) => b - a).slice(0, 4);
  const frK = {};
  for (const L of frLabels) for (const ck in data.fr[L].combos) {
    const [s, i] = ck.split('|').map(Number); const k = keyOf(s, i); if (!k) continue;
    const v = data.fr[L].combos[ck], x = frK[k] || (frK[k] = { oa: 0, ra: 0, om: 0, rm: 0 });
    x.oa += v.oa; x.ra += v.ra; x.om += v.om; x.rm += v.rm;
  }

  /* universo de combinaciones: DSS vigente */
  const combos = {};
  for (const r of (data.dss ? data.dss.rows : [])) {
    const b = byItem[r.i];
    if (!b) { warnings.push('Item ' + r.i + ' no está en el maestro de items'); continue; }
    const it = items[b.clave]; if (it.activo === false) continue;
    const st = storeType(r.s) || r.t;
    const so = P.stores[r.s] || {};
    if (so.estado === 'Inactiva') continue;
    const k = r.s + '|' + b.clave;
    const x = combos[k] || (combos[k] = {
      key: k, s: r.s, clave: b.clave, st, name: r.name, city: r.city, open: r.open, oh: 0, it: 0, iw: 0, oo: 0,
      vnpk: it.vnpk || r.vnpk || 1, seqDss: null, items: [], mant: false
    });
    x.oh += r.oh; x.it += r.it; x.iw += r.iw; x.oo += r.oo;
    x.items.push(r.i);
    if (r.t !== st) x.mant = true;
    if (r.t === 33 && r.seq) x.seqDss = r.seq;
  }

  const res = [];
  const horizon = 18;
  const lastSnapFcstLabels = lastSnap ? lastSnap.weeks.filter(l => l >= cur.label).slice(0, 7) : [];
  for (const k in combos) {
    const x = combos[k], it = items[x.clave], st = x.st;
    const fq = freq[x.s] || {}, so = P.stores[x.s] || {}, sm = storesM[x.s] || {};
    const open = x.open ? parseISO(x.open) : null;
    if (open && open > t0) { continue; }
    const H = hist[k] || {};
    /* demanda base semanal */
    const weeks = ventaLabels.filter(L => H[L]).slice(0, 4);
    const wts = [0.4, 0.3, 0.2, 0.1];
    let dem = 0, wsum = 0, zeroDays = 0;
    const histRows = [];
    weeks.forEach((L, j) => {
      const v = H[L]; const z = v.d.filter(q => q <= 0).length;
      let corr = v.pos;
      if (z >= 2 && z < 7 && v.pos / (7 - z) >= 2) corr = Math.min(v.pos / (7 - z) * 7, v.pos * 1.6);
      if (j === 0) zeroDays = z;
      dem += corr * wts[j]; wsum += wts[j];
    });
    for (const L of ventaLabels.slice(0, 6).reverse()) {
      const v = H[L]; histRows.push({ label: L, pos: v ? v.pos : 0, fcst: fcstAsOf(k, L) });
    }
    dem = wsum ? dem / wsum : 0;
    const insK = ins[k];
    let demFuente = 'historia ' + weeks.length + ' sem';
    if (weeks.length === 0 && insK) { dem = insK.vd * 7; demFuente = 'instock 35 días'; }
    else if (weeks.length === 1 && insK) { dem = (dem + insK.vd * 7) / 2; demFuente = '1 sem + instock 35 días'; }
    if (weeks.length === 0 && !insK) demFuente = 'sin historia';
    const demD = dem / 7;
    /* forecast */
    const F = fcstNow[k] || null;
    const fcstW = {}; for (const L of lastSnapFcstLabels) fcstW[L] = F && F[L] != null ? F[L] : null;
    const next4 = lastSnapFcstLabels.slice(0, 4).map(L => fcstW[L]).filter(v => v != null);
    const fcst4 = next4.length ? next4.reduce((a, b) => a + b, 0) / next4.length : null;
    /* sesgo semana a semana (cuando hay snapshots) */
    const bias = [];
    for (const L of weeks) { const f = fcstAsOf(k, L); if (f != null) bias.push({ L, act: H[L].pos, f, dev: f > 0 ? (H[L].pos - f) / f : null }); }
    const minPct = G.desvMinPct / 100;
    const sig = b => (b.dev != null && Math.abs(b.dev) >= minPct && Math.abs(b.act - b.f) >= G.desvMinU) ? Math.sign(b.act - b.f) : 0;
    const up = bias.filter(b => sig(b) > 0).length, dn = bias.filter(b => sig(b) < 0).length;
    let sesgo = 0, sesgoTxt = '';
    if (bias.length >= 2) {
      if (up >= Math.min(G.sesgoSemanas, bias.length)) { sesgo = 1; sesgoTxt = 'venta > FCST ' + up + '/' + bias.length + ' sem'; }
      else if (dn >= Math.min(G.sesgoSemanas, bias.length)) { sesgo = -1; sesgoTxt = 'venta < FCST ' + dn + '/' + bias.length + ' sem'; }
    } else if (fcst4 != null && fcst4 > 0 && weeks.length) {
      const d = dem - fcst4;
      if (Math.abs(d) / fcst4 >= minPct && Math.abs(d) >= G.desvMinU) { sesgo = Math.sign(d); sesgoTxt = (d > 0 ? 'demanda > FCST ' : 'demanda < FCST ') + Math.round(Math.abs(d) / fcst4 * 100) + '% (promedio)'; }
    }
    /* devoluciones 4 semanas */
    const dv = devK[k] || {}; const dev4 = weeks.reduce((a, L) => a + (dv[L] || 0), 0);
    const pos4 = weeks.reduce((a, L) => a + H[L].pos, 0);
    const devPct = pos4 > 0 ? dev4 / pos4 : (dev4 > 0 ? 1 : 0);
    const devAlta = devPct >= G.devAltaPct / 100 && dev4 >= 2;
    /* fill rate */
    const fr = frK[k]; const frA = fr && fr.oa > 0 ? fr.ra / fr.oa : null;
    const frFactor = frA == null ? 1 : Math.max(0.3, Math.min(1, frA));
    /* entregas */
    const lead = G.leadTime[st] || 1;
    let dias = (fq.dias && fq.dias.some(Boolean)) ? fq.dias : null;
    if (st === 33) dias = [0, 1, 1, 1, 1, 1, 1];
    const sinFrec = st === 37 && !dias;
    if (!dias) { dias = [0, 0, 0, 0, 0, 0, 0]; (G.diasFallback || [1, 4]).forEach(d => dias[d] = 1); }
    const sh = share[st] || share[37];
    const evCache = {};
    const upl = L => evCache[L] || (evCache[L] = weekUplift(L, P.eventos, ov));
    const fcstDay = d => { const L = weekInfo(d, ov).label; const fw = F && F[L] != null ? F[L] : (fcst4 || 0); return fw * sh[d.getDay()]; };
    const demDay = d => { const L = weekInfo(d, ov).label; return dem * (1 + upl(L).pct) * sh[d.getDay()]; };
    const delivDays = [];
    for (let j = 1; j <= horizon + 10; j++) { const d = addDays(t0, j); if (dias[d.getDay()]) delivDays.push(j); }
    const firstDel = st === 33 ? 1 : (delivDays[0] || 1);
    const del = new Array(horizon).fill(0);
    if (st === 33) {
      if (firstDel < horizon) del[firstDel] += x.it + x.iw;
      if (lead - 1 < horizon) del[Math.max(1, Math.min(horizon - 1, lead - 1))] += x.oo;
    } else {
      if (firstDel < horizon) del[firstDel] += x.it + x.oo;
    }
    /* reposición futura de Walmart: cubre su propio FCST hasta la siguiente entrega, por el fill rate */
    /* Directa: si Walmart aún no creó la orden de la próxima visita (OO = 0 y hay tiempo), la creará con su FCST */
    const futDel = st === 33 ? delivDays.filter(j => j >= lead) : delivDays;
    for (let n = 0; n < futDel.length; n++) {
      const j = futDel[n]; if (j >= horizon) break;
      const nxt = futDel[n + 1] || j + 7;
      if (st === 37 && j === firstDel && (x.oo > 0 || firstDel <= lead)) continue;
      let q = 0; for (let z = j; z < nxt; z++) q += fcstDay(addDays(t0, z));
      del[j] += q * frFactor;
    }
    /* simulación diaria.
       ocDay = primer día en que una OC manual puede llegar (Directa: próxima visita; CEDI: cancel date CEDI).
       Lo que se pierde antes de ese día no lo corrige una OC; lo de después sí. */
    const ocDay = st === 33 ? Math.max(1, G.cancelCedi) : firstDel;
    let inv = Math.max(0, x.oh); const proj = []; let lostPre = 0, lostPost = 0, quiebre = null, invOc = 0, demCov = 0;
    const diasInv = G.diasInv[st] || 4;
    for (let j = 0; j < horizon; j++) {
      const d = addDays(t0, j);
      const ini = inv; inv += del[j];
      const dm = j === 0 ? demDay(d) * 0.5 : demDay(d); // el día de hoy ya avanzó
      if (j === ocDay) invOc = inv;
      if (j >= ocDay && j < ocDay + diasInv) demCov += dm;
      const sale = Math.min(inv, dm), lost = dm - sale; inv -= sale;
      if (j < ocDay) lostPre += lost;
      else if (j < ocDay + G.horizonteRojo) lostPost += lost;
      if (lost > 0.5 && quiebre == null && j < ocDay + G.horizonteRojo) quiebre = j;
      proj.push({ date: ymd(d), dow: d.getDay(), ini: Math.round(ini), del: Math.round(del[j]), dem: Math.round(dm * 10) / 10, fin: Math.round(inv), lost: Math.round(lost * 10) / 10, oc: j === ocDay });
    }
    const lost7 = lostPre + lostPost;
    const cov = demD > 0 ? (Math.max(0, x.oh) + x.it) / demD : null;
    /* estado */
    let estado = 'verde', motivo = '';
    const red = lostPost >= 1;
    const frBajo = frA != null && frA < (G.frObj[st] - G.frBajoPts) / 100;
    if (red) estado = 'rojo';
    else if (sesgo !== 0 || devAlta || lostPre >= 1 || (F == null && dem > 0)) estado = 'amarillo';
    if (F == null && dem > 0) motivo = 'Sin FCST';
    else if ((red || lostPre >= 1) && frBajo) motivo = 'Fill rate bajo (panadería)';
    else if (sesgo > 0) motivo = 'FCST bajo';
    else if (devAlta && zeroDays >= 2) motivo = 'Rotación / frecuencia';
    else if (devAlta || sesgo < 0) motivo = 'FCST alto' + (devAlta ? ' / devolución' : '');
    else if ((red || lostPre >= 1) && x.oh <= 0) motivo = 'Ejecución en tienda';
    else if (red) motivo = 'Pedido Walmart insuficiente';
    else if (lostPre >= 1) motivo = 'Quiebre antes de la entrega';
    /* OC manual sugerida */
    let ocQty = 0, ocCancel = null;
    if (estado === 'rojo') {
      const vida = (it.vida || G.vidaUtil);
      /* cubrir lo que se pierde y dejar la tienda con los días de inventario objetivo al llegar la OC */
      let q = Math.max(lostPost, demCov - invOc) + (G.diasSeguridad[st] || 0) * demD;
      q = Math.min(q, demD * vida, dem * 3);
      const vn = x.vnpk || 1; ocQty = Math.max(vn, Math.ceil(q / vn) * vn);
      if (st === 37) ocCancel = ymd(addDays(t0, ocDay + num(so.offset)));
      else ocCancel = ymd(addDays(t0, G.cancelCedi));
    }
    /* ajuste de FCST sugerido */
    const fcstSug = {};
    if (sesgo !== 0 || devAlta) for (const L of lastSnapFcstLabels) fcstSug[L] = Math.max(0, Math.round(dem * (1 + upl(L).pct)));
    const itemVig = st === 33 ? it.itemC : it.itemD;
    const seq = st === 33 ? (it.seqC || x.seqDss || 1) : 0;
    res.push({
      key: k, s: x.s, clave: x.clave, item: itemVig, st, canal: st === 33 ? 'CEDI' : 'Directa', seq,
      name: fq.nombre || x.name, dssName: x.name, formato: sm.formato || fq.formato || '', vendedor: fq.vendedor || '',
      desc: it.desc, descOC: it.descOC || it.desc, codigoOC: it.codigoOC, vnpk: x.vnpk,
      oh: x.oh, it: x.it, iw: x.iw, oo: x.oo, dem: Math.round(dem * 10) / 10, demD: Math.round(demD * 100) / 100, demFuente,
      zeroDays, fcstW, fcst4: fcst4 == null ? null : Math.round(fcst4 * 10) / 10, hist: histRows, bias, sesgo, sesgoTxt,
      dev4, devPct, devAlta, frA, frM: fr && fr.om > 0 ? fr.rm / fr.om : null, cov: cov == null ? null : Math.round(cov * 10) / 10,
      proj, lost7: Math.round(lost7 * 10) / 10, lostPre: Math.round(lostPre * 10) / 10, lostPost: Math.round(lostPost * 10) / 10, ocDate: ymd(addDays(t0, ocDay)), quiebre: quiebre == null ? null : ymd(addDays(t0, quiebre)),
      estado, motivo, ocQty, ocCancel, fcstSug, mant: x.mant, dssItems: x.items, sinFrec,
      dias, offset: num(so.offset), uplifts: lastSnapFcstLabels.map(L => ({ L, ...upl(L) }))
    });
  }
  const rank = { rojo: 0, amarillo: 1, verde: 2 };
  res.sort((a, b) => rank[a.estado] - rank[b.estado] || b.lostPost - a.lostPost || b.lost7 - a.lost7 || Math.abs(b.dem - (b.fcst4 || 0)) - Math.abs(a.dem - (a.fcst4 || 0)));
  return {
    t0: ymd(t0), week: cur.label, weekStart: ymd(cur.start), weekEnd: ymd(cur.end), combos: res, share,
    ventaWeeks: ventaLabels, frWeeks: frLabels, fcstWeeks: lastSnapFcstLabels, snapshots: snaps.map(s => s.requested),
    warnings: Array.from(new Set(warnings))
  };
};

/* fill rate total de la semana por canal y tipo de orden */
Core.frSummary = function (fr, params) {
  const out = {};
  for (const ev in fr.eventos) {
    const e = fr.eventos[ev]; const cls = Core.poClass(ev, params);
    for (const t in e.t) {
      const k = t + '|' + cls, o = out[k] || (out[k] = { t: +t, cls, ord: 0, rec: 0 });
      o.ord += e.t[t].ord; o.rec += e.t[t].rec;
    }
  }
  return Object.values(out);
};

/* comparación frecuencias (archivo maestro) vs órdenes automáticas de Walmart */
Core.compareFrecuencias = function (freq, frWeeks, params) {
  const labels = Object.keys(frWeeks || {}).map(Number).sort((a, b) => b - a).slice(0, 4);
  const pat = {};
  for (const L of labels) for (const s in frWeeks[L].stores) {
    const st = frWeeks[L].stores[s]; if (+st.t !== 37) continue;
    const p = Object.keys(st.ca).map(Number).sort().join(',');
    (pat[s] || (pat[s] = {}))[p] = ((pat[s] || {})[p] || 0) + 1;
  }
  const out = [];
  const name = a => a.map(d => DIA[d]).join('·');
  const all = new Set([...Object.keys(freq).filter(s => freq[s].type === 37), ...Object.keys(pat)]);
  for (const s of all) {
    const f = freq[s]; const off = num(((params.stores || {})[s] || {}).offset);
    const fd = f ? f.dias.map((v, d) => v ? d : -1).filter(d => d >= 0) : [];
    const exp = fd.map(d => (d + off) % 7).sort().join(',');
    const p = pat[s] ? Object.entries(pat[s]).sort((a, b) => b[1] - a[1])[0][0] : null;
    const wd = p ? p.split(',').filter(Boolean).map(Number) : [];
    let estado = 'igual';
    if (!f) estado = 'sin archivo'; else if (!p) estado = 'sin órdenes';
    else if (exp !== p) {
      const plus1 = fd.map(d => (d + off + 1) % 7).sort().join(',');
      estado = plus1 === p ? '+1 día' : 'difiere';
    }
    out.push({ s: +s, nombre: f ? f.nombre : '', archivo: name(fd), walmart: name(wd), estado });
  }
  return out.sort((a, b) => a.s - b.s);
};

/* seguimiento de OC solicitadas contra lo recibido (Fill Rate) */
Core.trackOC = function (solicitudes, frWeeks) {
  const lines = [];
  for (const L in frWeeks || {}) for (const m of frWeeks[L].manual) lines.push(m);
  return (solicitudes || []).map(sol => {
    let sol_u = 0, rec = 0, enc = 0;
    for (const l of sol.lines) {
      sol_u += l.qty;
      const c = lines.filter(m => m.s === l.s && m.i === l.i && m.ca && Math.abs(diffDays(parseISO(m.ca), parseISO(l.cancel))) <= 2);
      if (c.length) { enc++; rec += c.reduce((a, m) => a + m.rec, 0); }
    }
    return { ...sol, solicitado: sol_u, recibido: rec, encontradas: enc, pct: sol_u ? rec / sol_u : null };
  });
};

if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(typeof window !== 'undefined' ? window : this);
