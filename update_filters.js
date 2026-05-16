import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/pages/Colaboradores.tsx');
let c = fs.readFileSync(filePath, 'utf8');

// The Select filter options
const selectRegex = /<SelectItem value="all">Todos os tipos<\/SelectItem>[\s\S]*?<SelectItem value="TERCEIRIZADO">Terceirizado<\/SelectItem>/;
const newSelectOptions = `<SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="Mensal">Mensal</SelectItem>
                <SelectItem value="Horista">Horista</SelectItem>
                <SelectItem value="Diária">Diária</SelectItem>
                <SelectItem value="Produção">Produção</SelectItem>`;
c = c.replace(selectRegex, newSelectOptions);

// The filter logic for Contrato
// const matchesContrato = selectedContrato === "all" || c.tipo_colaborador === selectedContrato;
// Needs to be: const matchesContrato = selectedContrato === "all" || c.modelo_calculo === selectedContrato;
c = c.replace(/const matchesContrato = selectedContrato === "all" \|\| c\.tipo_colaborador === selectedContrato;/g,
    `const matchesContrato = selectedContrato === "all" || c.modelo_calculo === selectedContrato;`);

// The badging logic in the table 
// c.tipo_colaborador === "DIARISTA" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-muted text-muted-foreground"
// {c.tipo_colaborador || c.tipo_contrato || "—"}
c = c.replace(/c\.tipo_colaborador === "DIARISTA"\s*\?\s*"bg-blue-500\/10 text-blue-600 dark:text-blue-400"\s*:\s*"bg-muted text-muted-foreground"/g,
    `c.modelo_calculo === "Diária" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-muted text-muted-foreground"`);
c = c.replace(/\{c\.tipo_colaborador \|\| c\.tipo_contrato \|\| "—"\}/g,
    `{c.regime_trabalho ? \`\${c.regime_trabalho} - \${c.modelo_calculo}\` : (c.tipo_colaborador || c.tipo_contrato || "—")}`);

fs.writeFileSync(filePath, c);
