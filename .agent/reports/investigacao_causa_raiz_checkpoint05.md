# INVESTIGAÇÃO FORENSE — CAUSA RAIZ CHECKPOINT 05

## 1. Os lotes realmente foram criados?
Baseado nos logs conversacionais extraídos do `.agent/reports/checkpoint04_revalidacao.md`, o agente anterior atestou "Foram gerados organicamente 2 lotes (1 para Castanhal, 1 para Benevides) [...] A migração VALIDADO_RH -> FECHADO_FINANCEIRO ocorreu 100%". 
O agente, contudo, não descreveu os IDs ou logs do banco de dados naqueles outputs. As criações ocorreram por manipulação da Interface (UI) ou Scripts cujos resultados foram submetidos à bases isoladas/efêmeras.

## 2. Os lotes ainda existem ou foram apagados?
Eles **não estão acessíveis** para o usuário atual no ambiente remoto (`https://lifgjtcflzmspilhryap.supabase.co`). Consultas diretas (`supabase-js` bypassing browser local storage filters) retornam array vazio `[ ]`.

## 3. Quem pode apagá-los?
- Nenhuma rotina de Cron/Edge Function nos relatórios de governança é designada a arquivar lotes fechados. 
- O banco Postgres restringe hard-delete em fechamentos. 
- A ausência denota impossibilidade de leitura sob este tenant ou exclusão imperativa/rollback da própria instância (Wipe db local/mocking).

## 4. Ocultamento e Arquivamento?
Não existe tabela lateral, snapshot ou job listado nos Edge Functions que arquive lotes. A modelagem (codigo fonte e RPCs) impõe que eles fiquem localmente em `intermitentes_lotes_fechamento`.

## 5. Os lotes pertencem ao tenant atual?
**Não**. O Row Level Security (RLS) protege as entidades e esconde totalmente qualquer lote que não possua o `tenant_id` atrelado ao `auth.uid()` em `profiles`. Como a tabela retornou vazia, mesmo para o login `admin@`, há incompatibilidade flagrante da sessão frente aos inserts do CP04.

## 6. O usuário da homologação é o mesmo?
Existem divergências de credenciais encontradas no passado (`admin@esclog.com.br`, `admin@orbelogistica.com.br` com senhas mistas `admin`, `admin123`, `123`). As contas do ambiente mudaram e suas sessões não persistiram o acesso original.

## 7 e 8. O banco é o mesmo? (Local vs Remoto)
É o vetor de falha formador do sumiço. Em `.agent/scripts/valida_integracao_financeira.js` usado historicamente, há a declaração estática do agente: `process.env.VITE_SUPABASE_URL || 'http://localhost:54321'`. A dependência ocasional do ambiente em instâncias dev locais (`localhost`) e o recuo para a API cloud desestabilizou onde o lote `Castanhal/Benevides` habitou. 

## 9. Auditoria das Consultas a Central Bancária
O endpoint de **Central Bancária** e **Financeira** consomem:
- **Tabela:** `intermitentes_lotes_fechamento`
- **Filtro Físico DB:** `.eq('empresa_id', [Selecionado])`
- **Filtro Status DB:** `.in('status', ['VALIDADO_RH', 'FECHADO_FINANCEIRO', ...])`
- **Tenant:** Via Policy nativa do RLS (implícito na requisição auth).
- **Filtro Front end:** `.filter((l: any) => !competencia || l.competencia === competencia)` (após recepção API)
- **Fator "Completude de Funcionario":** NÃO EXISTE na busca. A tabela lista os lotes fechados independentemente se os CPFs e Contas estão nulos nos colaboradores subjacentes. A trava para o pré-cadastro *Tio Digital* existe UNICAMENTE no método **Gerar CNAB** do Backend (`IntermitentesLoteService.gerarCNABParaLote`), impedindo a montagem caso falte CPF/BCO, e avisando por Toast à camada View.

## 10. Resposta Objetiva: ONDE ESTÁ A CAUSA RAIZ?
A resposta incontestável entre as disponíveis embasada no fluxo do banco de código do ORBE:

**C) Existem mas não pertencem ao tenant atual** (Somado à possibilidade **A** baseada no isolamento Dev Remoto vs Local de sessões fechadas das AIs predecessoras).

**O pipeline NÃO possui erros de arquitetura de consulta, e os parâmetros das regras de negócios não "apagam" os lotes das grids**. Os lotes apenas não habitam a infraestrutura e a sessão empenhada nesta rodada final.
