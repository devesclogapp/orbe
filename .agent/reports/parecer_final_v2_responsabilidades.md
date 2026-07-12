# Respostas ao Parecer Obrigatório

**1. O relatório V2 anterior confundiu alguma função?**
**Com certeza.** O relatório arquitetural antigo partiu da premissa de que *todos os módulos realizam o cadastro no mesmo momento da ingestão do evento operacional*. Eu desconhecia a separação do Tio Digital em 2 Edge Functions independentes (Workflow A `colaboradores` vs Workflow B `intermitentes`). Isso invalidou em partes a afirmação de que o Tio Digital não tentava criar empresas; ele de fato tenta, porém *apenas na esteira de RH (Wkf A)*.

**2. O Tio Digital realmente possui fallback nulo atualmente?**
**SIM.** No *Workflow B (Lançamentos de Intermitentes)*, o código (`importar-intermitentes-tio`) é expressamente instruído a ser passivo: se ele não achar a empresa que o *Workflow A* deveria ter criado, ele joga `empresa_id: null` para que o ponto ou lançamento de operação não acuse erro fatal de PK.

**3. Qual implementação deve ser considerada a referência homologada?**
O Tio Digital (A + B) é a abordagem mais modular logicamente do ponto de vista de microsserviços. Contudo, **o ORBE abraçou e homologou o fluxo do RHID (`importar-pontos-rhid`)** — onde o importador operacional atua agressivamente para corrigir falhas e lacunas cadastrais "on the fly" sem derrubar as requests. Portanto, a agilidade do RHID em prover Self-Healing em tempo real é a **referência canônica validada pelo cliente**.

**4. É seguro extrair essa lógica sem alterar o comportamento do CLT?**
**Absolutamente Seguro.** 
Se extrairmos o snippet de "Criação de Provisórios" (`"if (!matchedEmpresaId) { const { data } = supabase..insert({cadastro_provisorio: true}) }"`) para fora de `importar-pontos-rhid` enviando-o para uma Sub-Rotina (RPC Database ou Function Module Helper), passaremos apenas a *injetar a mesma sub-rotina no Workflow B do Tio Digital*. O RHID continuará chamando a exata mesma lógica (mas modularizada), enquanto o `importar-intermitentes-tio` evoluirá para herdar esse poder de Self-Healing em tempo real e não largar mais lotes vazados sem empresa.

**5. Quais arquivos precisam realmente ser modificados?**
1. O backend para abrigar a Rule Module Compartilhada: 
   *(Criar uma RPC function `fn_resolve_or_create_provisorio` no Postgres via sql).*
2. A Edge Function do **RHID**: `importar-pontos-rhid/index.ts` *(Substituir a lógica chumbada de Self-Healing para que dispare a RPC).*
3. A Edge Function Manual: `importar-pontos-manual/index.ts` *(Idem item 2).*
4. A Edge Function Intermitentes: `importar-intermitentes-tio/index.ts` *(Remover fallback de `null` e plugar na nova RPC de Self-Healing).*

**(Opcional mas recomendado):** Adequar `importar-colaboradores-tio/index.ts` para já beber da mesma fonte centralizada (RPC Substituta/Modular).

Dessa forma, você extermina código repetido e garante imunidade absoluta contra `empresa_id = null` na hora do ponto.
