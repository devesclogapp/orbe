const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/flavi/Downloads';
const files = fs.readdirSync(dir).filter(f => f.startsWith('PGTO_') && f.endsWith('.txt'));
if (files.length === 0) {
    console.error('No PGTO files found');
    process.exit(1);
}
// Sort by newest
files.sort((a, b) => fs.statSync(path.join(dir, b)).mtime.getTime() - fs.statSync(path.join(dir, a)).mtime.getTime());

const content = fs.readFileSync(path.join(dir, files[0]), 'utf8');
const lines = content.split('\n').map(l => l.replace(/\r/g, '')).filter(l => l.length === 240);

const retLines = [];
let totalValor = 0;

for (let line of lines) {
    if (line[7] === '0') {
        // codigoArquivo at index 142 (0-indexed is 142) -> '2'
        retLines.push(line.substring(0, 142) + '2' + line.substring(143));
    } else if (line[7] === '1') {
        retLines.push(line);
    } else if (line[7] === '3' && line[13] === 'A') {
        // codigoMovimento at 14, 15 (0-indexed is 15-16)
        retLines.push(line.substring(0, 15) + '00' + line.substring(17));
    } else if (line[7] === '3' && line[13] === 'B') {
        retLines.push(line);
    } else if (line[7] === '5') {
        retLines.push(line);
    } else if (line[7] === '9') {
        retLines.push(line);
    } else {
        retLines.push(line);
    }
}

fs.writeFileSync(path.join(dir, files[0].replace('.txt', '.ret')), retLines.join('\n'));
console.log('Fixed', files[0]);
