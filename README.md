# FruitSeeker v4 (PWA)

Corrección de precios:
- Nuevo parser que detecta el **separador decimal por la última aparición de '.' o ','** y elimina los separadores de miles.
- Funciona con formatos: `1.349,00`, `1,349.00`, `1349`, `1349,5`, `1 349,00`…
- Muestra formateado con dos decimales, respetando la configuración local del navegador.

Mantiene:
- No mostrar filas hasta que se teclea búsqueda.
- Tema blanco/azul, PWA offline, CSV directo y XLSX con `lib/xlsx.full.min.js`.
