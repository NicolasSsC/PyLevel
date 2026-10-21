import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/nicol/Downloads/PyLevel_Cronograma (2).xlsx'));
console.log((await wb.inspect({kind:'workbook,sheet,table',maxChars:2200,tableMaxRows:3,tableMaxCols:5})).ndjson);
for (const [sheetName,range] of [['Resumen','A1:H15'],['Cronograma','A1:R12']]) {
 const p = await wb.render({sheetName,range,scale:1,format:'png'});
 await fs.writeFile(new URL(`./original_${sheetName}.png`,import.meta.url),new Uint8Array(await p.arrayBuffer()));
}
