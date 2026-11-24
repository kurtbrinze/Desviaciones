# Análisis Desviaciones · PANISA · Walmart GT

App web (un solo archivo `index.html`) que analiza por combinación **tienda + item** la venta contra el FCST de Walmart, proyecta el inventario día a día y sugiere **OC manuales** (Directas 810, CEDI 811/812) y **ajustes de FCST**.

**Privacidad:** todo se procesa en el navegador. Los reportes de Retail Link se leen desde las carpetas de la computadora y nunca se suben a ningún servidor.

## Uso

1. Abrir `index.html` (o el enlace de GitHub Pages) en **Chrome** o **Edge**.
2. Elegir las carpetas:
   - **IA Analisis Desviaciones** (FCST, Venta Semanal, Devoluciones, Instock, RTL, Frecuencias, Excel YF, OC Manuales, Ajuste FCST).
   - **DataBase\Fill Rate\Por Combinacion** (archivos `FR SMW yyyyww Combinacion.xlsx` por año).
3. **Actualizar datos** procesa solo los archivos nuevos y guarda la historia en `_datos\` dentro de la carpeta del proyecto.

Rutina: sábado (Venta, Devoluciones, Instock 35 días) · martes (Fill Rate) · miércoles (FCST).

## Salidas

- `OC Manuales\Solicitudes\OC ADD Cancel Date MM DD YYYY Directa.xlsx` / `… PANISA 1.xlsx` / `… PANISA 2.xlsx`
- `Ajuste FCST\Solicitudes\Ajuste FCST MM DD YYYY.xlsx` (formato provisional)

## Desarrollo

```
npm install
python3 build.py   # genera index.html desde src/
```

- `src/core.js`: lectura de reportes, calendario Walmart (semana 1 = último sábado en o antes del 1 de febrero), eventos, proyección y semáforo.
- `src/index.src.html`: interfaz.
