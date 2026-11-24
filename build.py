"""Genera index.html (un solo archivo) a partir de src/.
Requiere: npm install  (instala xlsx y chart.js en node_modules)"""
src = open('src/index.src.html', encoding='utf-8').read()
def lib(p):
    return open(p, encoding='utf-8').read().replace('</script', '<\\/script')
src = src.replace('/*__XLSX__*/', lib('node_modules/xlsx/dist/xlsx.full.min.js'), 1)
src = src.replace('/*__CHART__*/', lib('node_modules/chart.js/dist/chart.umd.js'), 1)
src = src.replace('/*__EXCELJS__*/', lib('node_modules/exceljs/dist/exceljs.min.js'), 1)
src = src.replace('/*__CORE__*/', lib('src/core.js'), 1)
open('index.html', 'w', encoding='utf-8').write(src)
print('index.html', len(src), 'caracteres')
