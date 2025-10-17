import { parseCSV } from "./csv.js";
import { saveProducts, getAll, clearAll } from "./db.js";

const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

const els = {
  drop: $("#drop"),
  file: $("#filePick"),
  mapBox: $("#mapBox"),
  mapPart: $("#mapPart"),
  mapEan: $("#mapEan"),
  mapDesc: $("#mapDesc"),
  mapPrice: $("#mapPrice"),
  saveBtn: $("#saveBtn"),
  cancelMap: $("#cancelMap"),
  mapStatus: $("#mapStatus"),
  count: $("#count"),
  q: $("#q"),
  tbody: $("#tbl tbody"),
  resultCount: $("#resultCount"),
  clearBtn: $("#clearBtn"),
  toast: $("#toast"),
  netState: $("#netState"),
  offlineBadge: $("#offlineBadge"),
  searchInfo: $("#searchInfo"),
  noDataHint: $("#noDataHint"),
  emptyState: $("#emptyState"),
  xlsxBanner: $("#xlsxBanner"),
  demoBtn: $("#demoBtn"),
};

let DATA = [];
let SORT = { key: "partNumber", dir: 1 };
let headers = [];
let rows = [];

function showToast(msg){
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  setTimeout(()=> els.toast.classList.remove("show"), 2200);
}

function updateNetState(){
  const online = navigator.onLine;
  els.netState.textContent = online ? "online" : "offline";
  els.offlineBadge.className = "badge " + (online ? "ok" : "warn");
}
window.addEventListener("online", updateNetState);
window.addEventListener("offline", updateNetState);
updateNetState();

// PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

// ---- Header Auto-detect ----
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
    if(sc >= 3) break; // good enough
  }
  return best.idx;
}
function guessMap(hs){
  function find(terms){
    const i = hs.findIndex(h => terms.some(t=> normalize(h).includes(t)));
    return i >= 0 ? hs[i] : hs[0] || "";
  }
  return {
    part: find(KEYWORDS.part),
    ean: find(KEYWORDS.ean),
    desc: find(KEYWORDS.desc),
    price: find(KEYWORDS.price),
  };
}

function fillMapSelectors(hs){
  const fill = (sel)=>{
    sel.innerHTML = "";
    for(const h of hs){
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = h || "(vacío)";
      sel.appendChild(opt);
    }
  };
  fill(els.mapPart); fill(els.mapEan); fill(els.mapDesc); fill(els.mapPrice);
  const g = guessMap(hs);
  els.mapPart.value = g.part;
  els.mapEan.value = g.ean;
  els.mapDesc.value = g.desc;
  els.mapPrice.value = g.price;
}

function toNumberMaybe(s){
  if(s == null) return null;
  let t = (""+s).replace(/\s+/g,"").replace(/[€]/g,"").replace(",", ".");
  const m = t.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function renderCount(){
  els.count.textContent = DATA.length;
  els.noDataHint.classList.toggle("hidden", DATA.length>0);
}

function renderTable(rows){
  els.tbody.innerHTML = "";
  const frag = document.createDocumentFragment();
  for(const r of rows){
    const tr = document.createElement("tr");
    const td = (v)=>{ const t = document.createElement("td"); t.textContent = v ?? ""; return t; };
    tr.appendChild(td(r.partNumber));
    tr.appendChild(td(r.ean));
    tr.appendChild(td(r.description));
    tr.appendChild(td(r.price != null ? (r.price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})) : (r.priceStr||"")));
    frag.appendChild(tr);
  }
  els.tbody.appendChild(frag);
  els.emptyState.classList.toggle("hidden", rows.length>0);
}

function tokens(s){ return s.toLowerCase().split(/\s+/).filter(Boolean); }
function filtered(all){
  const q = $("#q").value.trim();
  if(!q) return all.slice(0, 1000);
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

// Sorting
$$("th[data-k]").forEach(th=> th.addEventListener("click", ()=>{
  const key = th.dataset.k;
  if(SORT.key === key) SORT.dir *= -1; else { SORT.key = key; SORT.dir = 1; }
  const rows = filtered(DATA).sort((a,b)=>{
    const av = a[key] ?? ""; const bv = b[key] ?? "";
    return (av < bv ? -1 : av > bv ? 1 : 0) * SORT.dir;
  });
  renderTable(rows);
}));

// Clear DB
$("#clearBtn").addEventListener("click", async ()=>{
  if(!confirm("¿Borrar todos los datos guardados en este dispositivo?")) return;
  await clearAll(); DATA = []; renderCount(); doSearch(); showToast("Datos borrados.");
});

// DRAG & DROP
function onDragOver(e){ e.preventDefault(); $("#drop").classList.add("drag"); }
function onDragLeave(){ $("#drop").classList.remove("drag"); }
function onDrop(e){
  e.preventDefault(); $("#drop").classList.remove("drag");
  const f = e.dataTransfer.files?.[0];
  if(f) handleFile(f);
}
$("#drop").addEventListener("dragover", onDragOver);
$("#drop").addEventListener("dragleave", onDragLeave);
$("#drop").addEventListener("drop", onDrop);
$("#filePick").addEventListener("change", (e)=>{
  const f = e.target.files?.[0];
  if(f) handleFile(f);
});

// Demo data
$("#demoBtn").addEventListener("click", async ()=>{
  const demo = [
    {partNumber:"MP7K3TY/A", ean:"0194253000001", description:"iPad 10.2\" Wi‑Fi 64GB Silver", priceStr:"379,00", price:379.00},
    {partNumber:"MPXT3SP/A", ean:"0194253000002", description:"iPad Air 11\" Wi‑Fi 128GB Blue", priceStr:"699,00", price:699.00},
    {partNumber:"MME73ZM/A", ean:"0194253000003", description:"AirPods (3rd gen) Lightning Case", priceStr:"199,00", price:199.00},
    {partNumber:"MK2K3ZM/A", ean:"0194253000004", description:"USB‑C to Lightning Cable (1 m)", priceStr:"25,00", price:25.00},
  ];
  await clearAll(); await saveProducts(demo, {uploadedAt:new Date().toISOString(), mapping:"demo"});
  DATA = await getAll(); renderCount(); doSearch(); $("#q").focus();
  showToast("Demo cargada. Prueba a buscar: iPad, AirPods…");
});

function showXlsxBanner(show){ els.xlsxBanner.style.display = show ? "grid" : "none"; }

// FILE HANDLING
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
        showXlsxBanner(true);
        showToast("Añade lib/xlsx.full.min.js al proyecto o exporta a CSV.");
        return;
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

// Save mapped rows to DB
$("#saveBtn").addEventListener("click", async ()=>{
  if(!rows.length){ showToast("No hay filas para guardar"); return; }
  const map = {
    part: $("#mapPart").value,
    ean: $("#mapEan").value,
    desc: $("#mapDesc").value,
    price: $("#mapPrice").value,
  };
  const idx = {
    part: headers.indexOf(map.part),
    ean: headers.indexOf(map.ean),
    desc: headers.indexOf(map.desc),
    price: headers.indexOf(map.price),
  };
  if(Object.values(idx).some(v => v < 0)){ showToast("Revisa el mapeo: hay columnas sin asignar."); return; }
  const items = [];
  for(const r of rows){
    const it = {
      partNumber: (r[idx.part] ?? "").toString().trim(),
      ean: (r[idx.ean] ?? "").toString().trim(),
      description: (r[idx.desc] ?? "").toString().trim(),
      priceStr: (r[idx.price] ?? "").toString().trim(),
    };
    it.price = toNumberMaybe(it.priceStr);
    if(it.partNumber || it.ean || it.description || it.priceStr){ items.push(it); }
  }
  await clearAll(); await saveProducts(items, {uploadedAt: new Date().toISOString(), mapping: map});
  DATA = await getAll(); renderCount(); doSearch(); $("#mapBox").classList.add("hidden"); $("#q").focus();
  showToast(`Guardado ${items.length} filas en este dispositivo.`);
});

$("#cancelMap").addEventListener("click", ()=>{ $("#mapBox").classList.add("hidden"); headers=[]; rows=[]; });

(async function init(){ DATA = await getAll(); renderCount(); doSearch(); })();
