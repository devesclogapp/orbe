const fs = require('fs');
const path = '../src/pages/LancamentoProducao.tsx';
let f = fs.readFileSync(path, 'utf8').split('\n');

const imp = 'import { TimePickerField } from "@/components/operacoes/lancamento/TimePickerField";';
f.splice(55, 0, imp);

// 194 shifted by 1 = 195. Remove 140 lines
f.splice(195, 140);

fs.writeFileSync(path, f.join('\n'));
console.log('Feito');
