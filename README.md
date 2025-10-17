# FruitSeeker (PWA)

Buscador offline de productos para GitHub Pages. 

**Qué hace:**
- Sube un **CSV o XLSX**.
- Mapea columnas a **Part number**, **EAN**, **Description** y **ALP Inc VAT**.
- Guarda el dataset en **IndexedDB** (solo en el dispositivo).
- Busca por **cualquier dato** (AND de términos). Tabla ordenable.
- Funciona **offline** (Service Worker).

> XLSX sin internet: añade `lib/xlsx.full.min.js` (SheetJS CE) dentro de `lib/`. Con **CSV** funciona sin librerías adicionales.

## Publicar en GitHub Pages
1. Sube todos los archivos del proyecto a un repo.
2. Settings → Pages → *Deploy from a branch* (branch `main` / folder `/`).
3. Abre la URL, sube tu archivo, mapea, **Guarda en este dispositivo** y busca.

