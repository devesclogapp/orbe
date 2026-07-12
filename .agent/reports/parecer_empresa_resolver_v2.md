# Parecer Obrigatório V2 — Correção e Viabilidade de Extração

**1. O relatório V2 anterior confundiu alguma função?**
**SIM.** O relatório passado assumiu que o Tio Digital possuía apenas um Edge Function e realizava a mesma injeção unificada do RHID. Com a revisão, constatou-se que o Tio Digital possui fluxos isolados (A para cadastro, B para pontos), enquanto os domínios CLT (RHID/Manual) fundem Cadastro e Lançamento num importador monobloco auto-curativo.

**2. O Tio Digital realmente possui fallback nulo atualmente?**
**SIM.** A Edge Function que recebe e processa o Ponto/Lançamento final dos intermitentes (`importar-intermitentes-tio`) limita-se a varrer superficialmente o texto. Se a correspondência não bater, a variável assume `fallbackEmpresaId = null`, resultando em um lote financeiro invisível e inutilizável. 

**3. Qual implementação deve ser considerada a referência homologada?**
A **implementação do RHID** (`importar-pontos-rhid`). Apesar de amalgamar domínios de Cadastro + Lançamentos na mesma função, ela atende integralmente à regra primária e inegociável do ORBE: *O sistema não pode derrubar uma automação ou deixar o dado solto; ele deve gerar as cascas provisórias, persistir a amarra 1:1 e permitir atuação/correção assíncrona do RH depois*. O RHID entrega a robustez real exigida pelo negócio.

**4. É seguro extrair essa lógica sem alterar o comportamento do CLT?**
**SIM, ALTAMENTE SEGURO.** O objetivo será clonar as exortações "Self-Healing" (On-The-Fly inserts com flag `cadastro_provisorio`) atualmente hardcoded em `importar-pontos-rhid/index.ts` e exportá-las para um Util compartilhado (RPC Database ou Service Deno Modular). A função do RHID chamará esse Util agnóstico. O efeito final na CLT é impacto **zero**, garantindo comportamento 100% inalterado, apenas melhor organizado no back-end.

**5. Quais arquivos precisam realmente ser modificados?**
Não dezenas. Uma intervenção minimalógica contemplará:
- *Criar:* Novo arquivo shared util / Supabase DDL Migration provisionando o Resolver Modularizado.
- *Ajustar Consumidores (Substituir insert manual pela chamada do util):*
  1. `supabase/functions/importar-pontos-rhid/index.ts`
  2. `supabase/functions/importar-pontos-manual/index.ts`
- *Implantar Nova Força:*
  3. `supabase/functions/importar-intermitentes-tio/index.ts` (Onde o null será sumariamente expurgado e herdará a inteligência auto-curativa).
  4. Melhorias em `importar-colaboradores-tio/index.ts` para já beber dessa mesma fonte limpa.
