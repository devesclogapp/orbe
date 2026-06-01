const fs = require('fs');

const code = fs.readFileSync('../src/services/base.service.ts', 'utf-8');
const lines = code.split('\n');

const imports = [];
const blocks = [];

let currentBlockName = 'imports';
let currentBlockContent = [];
let classOrConstNameRegex = /(?:export )?(?:class|const) ([A-Za-z0-9_]+)/;

for (let line of lines) {
    if (line.startsWith('import ') || line.trim().startsWith('//')) {
        if (currentBlockName === 'imports') {
            imports.push(line);
            continue;
        }
    }

    if (line.startsWith('// ===============================')) {
        // Just a comment line, continue
    }

    if (line.match(/^(?:export )?(?:class|const|function|interface|type) /) && !line.includes('={') && !line.includes('=>') && !line.includes('BaseService<') && !line.startsWith('export const ') && !line.startsWith('export function processar')) {
        // new block
        if (currentBlockName !== 'imports') {
            blocks.push({ name: currentBlockName, content: currentBlockContent });
        }

        let match = line.match(/(?:export )?(?:class|const|function|interface|type) ([A-Za-z0-9_]+)/);
        currentBlockName = match ? match[1] : 'unknown';
        currentBlockContent = [line];
    } else {
        if (currentBlockName !== 'imports') {
            currentBlockContent.push(line);
        } else {
            // we left imports block but didn't match a new block
            currentBlockName = 'core';
            currentBlockContent = [line];
        }
    }
}
if (currentBlockContent.length > 0) {
    blocks.push({ name: currentBlockName, content: currentBlockContent });
}

console.log("Found blocks:");
blocks.forEach(b => console.log(b.name, b.content.length + " lines"));

// Let's write the JSON to analyze it
fs.writeFileSync('ast_analysis.json', JSON.stringify({
    imports,
    blocks: blocks.map(b => ({ name: b.name, size: b.content.length }))
}, null, 2));

console.log("Analysis written to ast_analysis.json");
