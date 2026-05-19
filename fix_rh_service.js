const fs = require('fs');
const path = 'y:/2026/ERP ESC LOG/Orbe/src/services/rhProcessing.service.ts';
let content = fs.readFileSync(path, 'utf8');

// The broken lines look like:
//   if (String(colaborador.tipo_colaborador ?? " \).trim().toUpperCase() === \DIARISTA\) {
//  motivos.push(\Diaristas nao participam do Banco de Horas CLT\);
//  }

const brokenPattern = /if \(String\(colaborador\.tipo_colaborador \?\? " \\\)\.trim\(\)\.toUpperCase\(\) === \\DIARISTA\\\)/;

content = content.replace(brokenPattern, 'if (String(colaborador.tipo_colaborador ?? "").trim().toUpperCase() === "DIARISTA")');
content = content.replace('motivos.push(\\Diaristas nao participam do Banco de Horas CLT\\);', '    motivos.push("Diaristas não participam do Banco de Horas CLT");');

fs.writeFileSync(path, content, 'utf8');
console.log('File fixed successfully');
