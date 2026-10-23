import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const input = 'C:/Users/nicol/Downloads/PyLevel_Cronograma_corregido (1) (1).xlsx';
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(input));
console.log((await wb.inspect({kind:'workbook,sheet,table',maxChars:10000,tableMaxRows:8,tableMaxCols:12})).ndjson);
for (let i=0; i<wb.worksheets.items.length; i++) {
  const sheet = wb.worksheets.getItemAt(i);
  console.log('SHEET',sheet.name,JSON.stringify(sheet.getUsedRange().values));
}
const preview = await wb.render({sheetName:wb.worksheets.getItemAt(0).name,range:'A1:P22',scale:1.3,format:'png'});
await fs.writeFile(new URL('original.png',import.meta.url),new Uint8Array(await preview.arrayBuffer()));
