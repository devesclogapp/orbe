const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split('\n');
console.log(lines.map(l => l.split('=')[0]).join(', '));
