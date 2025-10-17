# Product Finder — Offline (PWA)

Buscador offline de productos para GitHub Pages. Permite:

- Subir un **CSV o XLSX** con tus datos.
- Elegir qué columnas corresponden a **Part number, EAN, Description** y **ALP Inc VAT**.
- Guardar el dataset **en el propio dispositivo (IndexedDB)** para uso **sin conexión**.
- Buscar por **cualquier dato** (AND de términos).
- Exportar los resultados filtrados a **CSV**.
- Borrar datos del dispositivo.

> 💡 Para soporte **XLSX** sin depender de internet, añade el archivo `lib/xlsx.full.min.js` (SheetJS CE) dentro de la carpeta `lib/`. La app lo detecta automáticamente. Con **CSV** funciona directamente sin librerías externas.

## Uso en GitHub Pages

1. Crea un repositorio y sube **todos** los archivos de esta carpeta.
2. Activa **GitHub Pages** en Settings → Pages → Source: “Deploy from a branch”, Branch: `main` (o `master`) y carpeta root `/`.
3. Abre la URL de Pages. La primera vez que se cargue, instala el **Service Worker**. La app funcionará **offline** a partir de entonces.
4. Sube tu archivo (**CSV o XLSX**). Mapea columnas si es necesario y pulsa **“Guardar en este dispositivo”**.
5. Ya puedes **buscar** sin conexión. Los datos permanecen solo en tu dispositivo.

## Consejos

- CSV: delimitador `,` o `;` detectado automáticamente. Soporta comillas y saltos de línea en campos.
- Excel: si no añadiste `lib/xlsx.full.min.js`, la app pedirá ese archivo para leer `.xlsx/.xls` **offline**.
- No se usan CDNs ni recursos externos: funciona con **cualquier Wi‑Fi** y **sin internet** tras la primera carga.
- Si cambias archivos del proyecto, recarga forzando el SW (Shift + Recargar) o limpia caché del navegador.
