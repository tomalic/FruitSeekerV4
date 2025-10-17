// Tiny IndexedDB wrapper
const DB_NAME = "fruitseeker_db";
const DB_VERSION = 1;
const STORE_PRODUCTS = "products";
const STORE_META = "meta";

function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE_PRODUCTS)){
        const s = db.createObjectStore(STORE_PRODUCTS, { keyPath: "id", autoIncrement: true });
        s.createIndex("partNumber", "partNumber", {unique:false});
        s.createIndex("ean", "ean", {unique:false});
      }
      if(!db.objectStoreNames.contains(STORE_META)){
        db.createObjectStore(STORE_META, { keyPath: "k" });
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

export async function clearAll(){
  const db = await openDB();
  await new Promise((resolve, reject)=>{
    const tx = db.transaction([STORE_PRODUCTS, STORE_META], "readwrite");
    tx.objectStore(STORE_PRODUCTS).clear();
    tx.objectStore(STORE_META).clear();
    tx.oncomplete = resolve; tx.onerror = ()=> reject(tx.error);
  });
  db.close();
}

export async function saveProducts(items, meta){
  const db = await openDB();
  await new Promise((resolve, reject)=>{
    const tx = db.transaction([STORE_PRODUCTS, STORE_META], "readwrite");
    const s = tx.objectStore(STORE_PRODUCTS);
    for(const it of items){ s.add(it); }
    tx.objectStore(STORE_META).put({k:"meta", v:meta || {}});
    tx.oncomplete = resolve; tx.onerror = ()=> reject(tx.error);
  });
  db.close();
}

export async function getAll(){
  const db = await openDB();
  const all = await new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE_PRODUCTS, "readonly");
    const s = tx.objectStore(STORE_PRODUCTS);
    const req = s.getAll();
    req.onsuccess = ()=> resolve(req.result || []);
    req.onerror = ()=> reject(req.error);
  });
  db.close();
  return all;
}

export async function getMeta(){
  const db = await openDB();
  const m = await new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE_META, "readonly");
    const s = tx.objectStore(STORE_META);
    const req = s.get("meta");
    req.onsuccess = ()=> resolve(req.result?.v || {});
    req.onerror = ()=> reject(req.error);
  });
  db.close();
  return m;
}
