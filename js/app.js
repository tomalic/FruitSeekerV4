import { parseCSV } from "./csv.js";
import { saveProducts, getAll, clearAll } from "./db.js";

const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

let DATA = [];
let headers = [];
let rows = [];

function showToast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), 2200);
}

function updateNetState(){
  const online = navigator.onLine;
  $("#netState").textContent = online ? "online" : "offline";
}
window.addEventListener("online", updateNetState);
window.addEventListener("offline", updateNetState);
updateNetState();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

function parsePriceSmart(s){
  if(s == null) return null;
  let t = (""+s).trim();
  if(!t) return null;
  t = t.replace(/[€\s]/g, "");
  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  let decPos = Math.max(lastDot, lastComma);
  if(decPos === -1){
    const num = t.replace(/[^\d-]/g,"");
    return num ? parseFloat(num) : null;
  }
  let intPart = t.slice(0, decPos).replace(/[.,]/g, "");
  let fracPart = t.slice(decPos+1).replace(/[.,]/g, "");
  const norm = intPart + "." + fracPart;
  const m = norm.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function normalize(s){ return (s||"").toString().trim().toLowerCase(); }
const KEYWORDS = {
  part: ["erp part number","part number","part","item","code","sku","p/n","pn"],
  ean: ["ean","barcode","bar code"],
  desc: ["erp part description","description","part description","product name","name","descripcion"],
  price: ["alp inc vat","price inc vat","inc vat","price","pvp","precio"]
};
function scoreHeaderRow(row){
  const cells = row.map(normalize);
  let score = 0;
  const matchAny = (arr)=> cells.some(c=> arr.some(k=> c.includes(k)));
  if(matchAny(KEYWORDS.part)) score++;
  if(matchAny(KEYWORDS.ean)) score++;
  if(matchAny(KEYWORDS.desc)) score++;
  if(matchAny(KEYWORDS.price)) score++;
  return score;
}
function findHeaderRow(rows){
  let best = {idx:0, score: -1};
  const limit = Math.min(rows.length, 50);
  for(let i=0;i<limit;i++){
    const sc = scoreHeaderRow(rows[i]);
    if(sc > best.score){ best = {idx:i, score: sc}; }
    if(sc >= 3) break;
  }
  return best.idx;
}
function guessMap(hs){
  function find(terms){
    const i = hs.findIndex(h => terms.some(t=> normalize(h).includes(t)));
    return i >= 0 ? hs[i] : hs[0] || "";
  }
  return { part: find(KEYWORDS.part), ean: find(KEYWORDS.ean), desc: find(KEYWORDS.desc), price: find(KEYWORDS.price) };
}
function fillMapSelectors(hs){
  const fill = (sel)=>{ sel.innerHTML = ""; for(const h of hs){ const o=document.createElement("option"); o.value=h; o.textContent=h||"(vacío)"; sel.appendChild(o);} };
  fill($("#mapPart")); fill($("#mapEan")); fill($("#mapDesc")); fill($("#mapPrice"));
  const g = guessMap(hs); $("#mapPart").value=g.part; $("#mapEan").value=g.ean; $("#mapDesc").value=g.desc; $("#mapPrice").value=g.price;
}

function renderCount(){ $("#count").textContent = DATA.length; }
function renderTable(rows){
  const tbody = $("#tbl tbody");
  tbody.innerHTML = "";
  const frag = document.createDocumentFragment();
  for(const r of rows){
    const tr = document.createElement("tr");
    const td = (v)=>{ const t = document.createElement("td"); t.textContent = v ?? ""; return t; };
    tr.appendChild(td(r.partNumber)); tr.appendChild(td(r.ean)); tr.appendChild(td(r.description));
    const priceOut = (r.price != null) ? r.price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) : (r.priceStr||"");
    tr.appendChild(td(priceOut));
    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
  $("#emptyState").classList.toggle("hidden", rows.length>0);
}
function tokens(s){ return s.toLowerCase().split(/\s+/).filter(Boolean); }
function filtered(all){
  const q = $("#q").value.trim();
  if(!q) return [];
  const toks = tokens(q);
  const rows = [];
  outer: for(const r of all){
    const blob = `${r.partNumber} ${r.ean} ${r.description} ${r.priceStr} ${r.price}`.toLowerCase();
    for(const t of toks){ if(!blob.includes(t)) continue outer; }
    rows.push(r);
    if(rows.length >= 1000) break;
  }
  return rows;
}
function doSearch(){
  const rows = filtered(DATA);
  $("#resultCount").textContent = rows.length;
  $("#searchInfo").textContent = rows.length >= 1000 ? " (mostrando primeros 1000)" : "";
  renderTable(rows);
}
["input","keyup","change"].forEach(ev=> $("#q").addEventListener(ev, doSearch));

$$("th[data-k]").forEach(th=> th.addEventListener("click", ()=>{
  const key = th.dataset.k;
  if(window._sortKey === key){ window._sortDir *= -1; } else { window._sortKey = key; window._sortDir = 1; }
  const rows = filtered(DATA).sort((a,b)=>{
    const av = a[key] ?? ""; const bv = b[key] ?? "";
    return (av < bv ? -1 : av > bv ? 1 : 0) * window._sortDir;
  });
  renderTable(rows);
}));

$("#clearBtn").addEventListener("click", async ()=>{
  if(!confirm("¿Borrar todos los datos guardados en este dispositivo?")) return;
  await clearAll(); DATA = []; renderCount(); doSearch(); showToast("Datos borrados.");
});

$("#filePick").addEventListener("change", (e)=>{
  const f = e.target.files?.[0];
  if(f) handleFile(f);
});

function showXlsxBanner(show){ const el = $("#xlsxBanner"); if(el) el.classList.toggle("hidden", !show); }

async function handleFile(file){
  const name = file.name.toLowerCase();
  if(name.endsWith(".csv")){
    const text = await file.text();
    const rowsRaw = parseCSV(text);
    if(!rowsRaw.length){ showToast("CSV vacío"); return; }
    const headerIdx = findHeaderRow(rowsRaw);
    headers = rowsRaw[headerIdx].map(h=> (h ?? "").toString().trim());
    rows = rowsRaw.slice(headerIdx+1);
    fillMapSelectors(headers);
    $("#mapBox").classList.remove("hidden");
    $("#mapStatus").textContent = `${file.name} — ${rows.length} filas detectadas`;
    showXlsxBanner(false);
  }else if(/\.(xlsx|xls)$/i.test(name)){
    if(!window.XLSX){
      try{
        const s = document.createElement("script");
        s.src = "./lib/xlsx.full.min.js";
        await new Promise((res, rej)=>{ s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      }catch(err){
        showXlsxBanner(true); showToast("Añade lib/xlsx.full.min.js al proyecto o exporta a CSV."); return;
      }
    }
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, {type:"array"});
    const first = wb.SheetNames[0];
    const ws = wb.Sheets[first];
    const rowsRaw = window.XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:""});
    if(!rowsRaw.length){ showToast("Excel sin datos"); return; }
    const headerIdx = findHeaderRow(rowsRaw);
    headers = rowsRaw[headerIdx].map(h=> (h ?? "").toString().trim());
    rows = rowsRaw.slice(headerIdx+1);
    fillMapSelectors(headers);
    $("#mapBox").classList.remove("hidden");
    $("#mapStatus").textContent = `${file.name} — ${rows.length} filas detectadas (cabecera en fila ${headerIdx+1})`;
    showXlsxBanner(false);
  }else{
    showToast("Formato no soportado. Usa CSV o XLSX.");
  }
}

$("#saveBtn").addEventListener("click", async ()=>{
  if(!rows.length){ showToast("No hay filas para guardar"); return; }
  const map = { part: $("#mapPart").value, ean: $("#mapEan").value, desc: $("#mapDesc").value, price: $("#mapPrice").value };
  const idx = { part: headers.indexOf(map.part), ean: headers.indexOf(map.ean), desc: headers.indexOf(map.desc), price: headers.indexOf(map.price) };
  if(Object.values(idx).some(v => v < 0)){ showToast("Revisa el mapeo: hay columnas sin asignar."); return; }
  const items = [];
  for(const r of rows){
    const it = { partNumber: (r[idx.part] ?? "").toString().trim(), ean: (r[idx.ean] ?? "").toString().trim(), description: (r[idx.desc] ?? "").toString().trim(), priceStr: (r[idx.price] ?? "").toString().trim() };
    it.price = parsePriceSmart(it.priceStr);
    if(it.partNumber || it.ean || it.description || it.priceStr){ items.push(it); }
  }
  await clearAll();
  await saveProducts(items, {uploadedAt: new Date().toISOString(), mapping: map});
  DATA = await getAll(); renderCount(); doSearch(); $("#mapBox").classList.add("hidden"); $("#q").focus();
  showToast(`Guardado ${items.length} filas en este dispositivo. Escribe para ver resultados.`);
});

(async function init(){ DATA = await getAll(); renderCount(); doSearch(); })();
