import { execSync } from 'child_process';
import fs from 'fs';

try {
  console.log('Iniciando vitest correlatos...');
  const output = execSync('npx vitest run src/test/conv08_fechamento_ciclos.test.tsx src/test/ux_clt_ponto_jornadas_oficial.test.tsx', {
    encoding: 'utf-8',
    cwd: 'y:/2026/ERP ESC LOG/Orbe',
    stdio: 'pipe',
    shell: 'powershell.exe'
  });
  fs.writeFileSync('scratch/vitest_correlatos_output.txt', output || 'PASSOU!', 'utf-8');
  console.log('Sucesso Vitest Correlatos:', output);
} catch (error) {
  const errOutput = (error.stdout || '') + '\n' + (error.stderr || '') + '\n' + (error.message || '');
  fs.writeFileSync('scratch/vitest_output.txt', String(errOutput), 'utf-8');
  console.error('Erro Vitest:', error.message);
}

