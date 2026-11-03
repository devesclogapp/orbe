import fs from 'node:fs';

async function checkBundle() {
  console.log('Baixando bundle de produção...');
  const res = await fetch('https://orbe-nu.vercel.app/assets/index-3a-e0eXp.js');
  if (!res.ok) {
    throw new Error(`Falha ao obter bundle: ${res.status}`);
  }
  const jsText = await res.text();
  console.log(`Bundle baixado. Tamanho: ${jsText.length} bytes.`);

  // Verificação P0-01
  const searchPattern1 = 'Registro com departamento/empresa ausente ou malformado';
  const searchPattern2 = 'Empresa/Departamento não reconhecido:';
  const hasP001_1 = jsText.includes(searchPattern1);
  const hasP001_2 = jsText.includes(searchPattern2);

  console.log(`P0-01 Pattern 1 ("${searchPattern1}") presente:`, hasP001_1);
  console.log(`P0-01 Pattern 2 ("${searchPattern2}") presente:`, hasP001_2);

  if (hasP001_1 && hasP001_2) {
    console.log('===> SUCESSO: A correção P0-01 ESTÁ INCLUÍDA no bundle publicado em produção!');
  } else {
    console.error('===> FALHA: Correção P0-01 NÃO encontrada no bundle publicado!');
  }
}

checkBundle().catch(console.error);

