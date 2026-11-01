import fs from 'fs';

let content = fs.readFileSync('schema_out_utf8.json');
// Remove potential BOM or null bytes
let str = content.toString('utf8').replace(/^\uFEFF/, '').replace(/\0/g, '');
try {
  const json = JSON.parse(str);
  console.log('Tabelas encontradas no schema:', Object.keys(json).sort());
} catch (e) {
  // Try utf16le
  try {
    str = content.toString('utf16le').replace(/^\uFEFF/, '').replace(/\0/g, '');
    const json = JSON.parse(str);
    console.log('Tabelas encontradas no schema (utf16le):', Object.keys(json).sort());
  } catch (err2) {
    console.error('Erro ao ler schema:', e.message);
  }
}
