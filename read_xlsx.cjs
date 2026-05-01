const xlsx = require('xlsx');
const p = require('path');
const wb = xlsx.readFile(p.join('src', '01 JANEIRO.xlsx'));
const sheetName = wb.SheetNames.find(n => n.toUpperCase().includes('TRANSBORDO'));
console.log('Sheet:', sheetName);
const sheet = wb.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log(data.slice(0, 5));
