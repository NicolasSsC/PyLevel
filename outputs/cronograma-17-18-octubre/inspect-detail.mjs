import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/nicol/Downloads/PyLevel_Cronograma_corregido (1) (1).xlsx'));
for (const name of ['Resumen','Cronograma']) {
 const sheet=wb.worksheets.getItem(name);
 console.log(name,'TABLES',JSON.stringify(sheet.tables.items.map(t=>({name:t.name}))));
 console.log(name,'FORMULAS',JSON.stringify(sheet.getUsedRange().formulas));
}
console.log(wb.help('worksheet rows insert',{search:'insert|rows',include:'index,examples,notes',maxChars:4500}).ndjson);
console.log((await wb.inspect({kind:'computedStyle',sheetId:'Cronograma',range:'A26:U35',maxChars:3000})).ndjson);
const preview=await wb.render({sheetName:'Cronograma',range:'A27:J36',scale:1.2,format:'png'});
await fs.writeFile(new URL('detalle-original.png',import.meta.url),new Uint8Array(await preview.arrayBuffer()));
await fs.writeFile(new URL('source-data.json',import.meta.url), JSON.stringify({Resumen:wb.worksheets.getItem('Resumen').getUsedRange().values,Cronograma:wb.worksheets.getItem('Cronograma').getUsedRange().values}));
