import fs from 'fs';
import path from 'path';

const migrationsDir = 'y:/2026/ERP ESC LOG/Orbe/supabase/migrations';
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

console.log('=== VARREDURA DE INSERTS EM cnab_auditoria_bancaria NAS MIGRATIONS ===\n');

const auditInserts = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  if (content.includes('cnab_auditoria_bancaria')) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('INSERT INTO public.cnab_auditoria_bancaria') || lines[i].includes('INSERT INTO cnab_auditoria_bancaria')) {
        // pegar as próximas 20 linhas
        const snippet = lines.slice(i, i + 25).join('\n');
        auditInserts.push({ file, line: i + 1, snippet });
      }
    }
  }
}

for (const it of auditInserts) {
  console.log(`--- [${it.file}:${it.line}] ---`);
  // Extrair o trecho de acao
  const matchAcao = it.snippet.match(/acao[^\)]*\)[^V]*VALUES\s*\([^\)]*\)/is) || it.snippet.match(/VALUES\s*\([\s\S]*?\)/is);
  console.log(it.snippet.slice(0, 400));
  console.log('\n');
}
