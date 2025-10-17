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
  tbl: $("#tbl"),
  tbody: $("#tbl tbody"),
  resultCount: $("#resultCount"),
  clearBtn: $("#clearBtn"),
  toast: $("#toast"),
  netState: $("#netState"),
  offlineBadge: $("#offlineBadge"),
  searchInfo: $("#searchInfo"),
  noDataHint: $("#noDataHint"),
  emptyState: $("#emptyState")
};

let DATA = []; // in-memory cache
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

// PWA: register SW
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

function guessMap(hs){
  const norm = (s)=> (s||"").toString().trim().toLowerCase();
  const find = (terms)=>{
    const idx = hs.findIndex(h=> terms.some(t => norm(h).includes(t)));
    return idx >= 0 ? hs[idx] : "";
  };
  return {
    part: find(["part", "p/n", "pn", "item", "code", "sku", "part number"]),
    ean: find(["ean", "barcode", "bar code"]),
    desc: find(["desc", "description", "product", "name", "descripcion"]),
    price: find(["alp inc vat", "inc vat", "price", "pvp", "precio", "price inc vat"]),
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
  if(g.part) els.mapPart.value = g.part;
  if(g.ean) els.mapEan.value = g.ean;
  if(g.desc) els.mapDesc.value = g.desc;
  if(g.price) els.mapPrice.value = g.price;
}

function toNumberMaybe(s){
  if(s == null) return null;
  let t = (""+s).replace(/\s+/g,"").replace(/[€]/g,"").replace(",", ".");
  const m = t.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function buildItems(hs, rows){
  const map = {
    part: els.mapPart.value,
    ean: els.mapEan.value,
    desc: els.mapDesc.value,
    price: els.mapPrice.value,
  };
  const idx = {
    part: hs.indexOf(map.part),
    ean: hs.indexOf(map.ean),
    desc: hs.indexOf(map.desc),
    price: hs.indexOf(map.price),
  };
  const items = [];
  for(const r of rows){
    const it = {
      partNumber: (r[idx.part] ?? "").toString().trim(),
      ean: (r[idx.ean] ?? "").toString().trim(),
      description: (r[idx.desc] ?? "").toString().trim(),
      priceStr: (r[idx.price] ?? "").toString().trim(),
    };
    it.price = toNumberMaybe(it.priceStr);
    if(it.partNumber || it.ean || it.description || it.priceStr){
      items.push(it);
    }
  }
  return {items, map};
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

function sortBy(key){
  if(SORT.key === key) SORT.dir *= -1;
  else { SORT.key = key; SORT.dir = 1; }
  const rows = filtered(DATA);
  rows.sort((a,b)=>{
    const av = a[key] ?? ""; const bv = b[key] ?? "";
    if(av < bv) return -1*SORT.dir;
    if(av > bv) return 1*SORT.dir;
    return 0;
  });
  renderTable(rows);
}

function tokens(s){
  return s.toLowerCase().split(/\s+/).filter(Boolean);
}

function filtered(all){
  const q = els.q.value.trim();
  if(!q) return all.slice(0, 1000); // safety limit
  const toks = tokens(q);
  const rows = [];
  outer: for(const r of all){
    const blob = `${r.partNumber} ${r.ean} ${r.description} ${r.priceStr} ${r.price}`.toLowerCase();
    for(const t of toks){
      if(!blob.includes(t)) continue outer;
    }
    rows.push(r);
    if(rows.length >= 1000) break;
  }
  return rows;
}

function doSearch(){
  const rows = filtered(DATA);
  els.resultCount.textContent = rows.length;
  els.searchInfo.textContent = rows.length >= 1000 ? " (mostrando primeros 1000)" : "";
  renderTable(rows);
}

// Make input super responsive and robust:
["input","keyup","change"].forEach(ev=> els.q.addEventListener(ev, doSearch));

// Sorting
$$("th[data-k]").forEach(th=>{
  th.addEventListener("click", ()=> sortBy(th.dataset.k));
});

// Clear DB
els.clearBtn.addEventListener("click", async ()=>{
  if(!confirm("¿Borrar todos los datos guardados en este dispositivo?")) return;
  await clearAll();
  DATA = [];
  renderCount();
  doSearch();
  showToast("Datos borrados.");
});

// DRAG & DROP
function onDragOver(e){ e.preventDefault(); els.drop.classList.add("drag"); }
function onDragLeave(){ els.drop.classList.remove("drag"); }
function onDrop(e){
  e.preventDefault(); els.drop.classList.remove("drag");
  const f = e.dataTransfer.files?.[0];
  if(f) handleFile(f);
}
els.drop.addEventListener("dragover", onDragOver);
els.drop.addEventListener("dragleave", onDragLeave);
els.drop.addEventListener("drop", onDrop);
els.file.addEventListener("change", (e)=>{
  const f = e.target.files?.[0];
  if(f) handleFile(f);
});

// FILE HANDLING
async function handleFile(file){
  if(file.name.toLowerCase().endsWith(".csv")){
    const text = await file.text();
    const rowsRaw = parseCSV(text);
    if(!rowsRaw.length){ showToast("CSV vacío"); return; }
    let hs = rowsRaw[0].map(h=> (h ?? "").toString().trim());
    // If header row seems not valid (numbers only), try to guess header from next row? keep as-is.
    headers = hs;
    rows = rowsRaw.slice(1);
    fillMapSelectors(headers);
    els.mapBox.classList.remove("hidden");
    els.mapStatus.textContent = `${file.name} — ${rows.length} filas detectadas`;
  }else if(/\.(xlsx|xls)$/i.test(file.name)){
    // Try to load local XLSX library if present
    if(!window.XLSX){
      try{
        await new Promise((resolve, reject)=>{
          const s = document.createElement("script");
          s.src = "./lib/xlsx.full.min.js"; // add this file locally to enable XLSX offline
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }catch(err){
        showToast("Para leer Excel offline, añade lib/xlsx.full.min.js al proyecto, o usa CSV.");
        return;
      }
    }
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, {type:"array"});
    const first = wb.SheetNames[0];
    const ws = wb.Sheets[first];
    const rowsRaw = window.XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:""});
    if(!rowsRaw.length){ showToast("Excel sin datos"); return; }
    headers = rowsRaw[0].map(h=> (h ?? "").toString().trim());
    rows = rowsRaw.slice(1);
    fillMapSelectors(headers);
    els.mapBox.classList.remove("hidden");
    els.mapStatus.textContent = `${file.name} — ${rows.length} filas detectadas`;
  }else{
    showToast("Formato no soportado. Usa CSV o XLSX.");
  }
}

// Save mapped rows to DB
els.saveBtn.addEventListener("click", async ()=>{
  if(!rows.length){ showToast("No hay filas para guardar"); return; }
  const map = {
    part: els.mapPart.value,
    ean: els.mapEan.value,
    desc: els.mapDesc.value,
    price: els.mapPrice.value,
  };
  const idx = {
    part: headers.indexOf(map.part),
    ean: headers.indexOf(map.ean),
    desc: headers.indexOf(map.desc),
    price: headers.indexOf(map.price),
  };
  // Validate mapping
  if(Object.values(idx).some(v => v < 0)){
    showToast("Revisa el mapeo: hay columnas sin asignar.");
    return;
  }
  const items = [];
  for(const r of rows){
    const it = {
      partNumber: (r[idx.part] ?? "").toString().trim(),
      ean: (r[idx.ean] ?? "").toString().trim(),
      description: (r[idx.desc] ?? "").toString().trim(),
      priceStr: (r[idx.price] ?? "").toString().trim(),
    };
    it.price = (()=>{
      let t = (it.priceStr || "").replace(/\s+/g,"").replace(/[€]/g,"").replace(",", ".");
      const m = t.match(/-?\d+(\.\d+)?/);
      return m ? parseFloat(m[0]) : null;
    })();
    if(it.partNumber || it.ean || it.description || it.priceStr){
      items.push(it);
    }
  }
  await clearAll(); // replace existing
  await saveProducts(items, {
    uploadedAt: new Date().toISOString(),
    mapping: map
  });
  DATA = await getAll();
  renderCount();
  doSearch();
  els.mapBox.classList.add("hidden");
  els.q.focus();
  showToast(`Guardado ${items.length} filas en este dispositivo.`);
});

els.cancelMap.addEventListener("click", ()=>{
  els.mapBox.classList.add("hidden");
  headers = []; rows = [];
});

// Load DB on startup
(async function init(){
  DATA = await getAll();
  renderCount();
  doSearch();
})();
