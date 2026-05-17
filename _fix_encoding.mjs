import { readFileSync, writeFileSync } from 'fs';

const filePath = 'y:/2026/ERP ESC LOG/Orbe/src/pages/CentralCadastros.tsx';
let content = readFileSync(filePath, 'utf8');

// The mojibake sequence: â (U+00E2) + € (U+20AC) + " (U+201D)
const bad = '\u00e2\u20ac\u201d';
const good = '\u2014'; // proper em-dash

const count = content.split(bad).length - 1;
console.log(`Found ${count} instances of mojibake em-dash`);

content = content.split(bad).join(good);

writeFileSync(filePath, content, 'utf8');
console.log('Replaced all instances with proper em-dash');
