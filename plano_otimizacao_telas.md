# Plano de Otimização de Telas do ERP Orbe

## Objetivo

Reorganizar e aglutinar telas que hoje estão separadas, mas fazem parte do mesmo fluxo mental e operacional do usuário, reduzindo trocas desnecessárias de contexto, cliques de navegação e retorno constante ao menu lateral.

O foco deste plano é melhorar:

- produtividade operacional
- acessibilidade e clareza de uso
- experiência do usuário
- continuidade de fluxo
- velocidade de decisão

---

## Diagnóstico Geral

Pelo mapeamento atual do sistema, há um padrão de fragmentação em que etapas consecutivas do mesmo trabalho foram distribuídas em telas diferentes. Isso obriga o usuário a:

- entrar em uma tela para consultar
- sair para outra tela para corrigir
- voltar ao menu para continuar o processo
- perder filtros, contexto e linha de raciocínio

Na prática, isso aumenta:

- tempo por tarefa
- chance de erro
- retrabalho
- dependência de memória do usuário
- sensação de sistema “quebrado em partes”

O princípio recomendado é:

`uma tela deve representar um objetivo de trabalho, não apenas um cadastro ou módulo técnico`

---

## Princípios de Agrupamento

As telas devem ser unificadas quando:

- o usuário naturalmente executa uma ação logo após a outra
- a decisão da segunda tela depende diretamente dos dados da primeira
- a navegação atual obriga o usuário a trocar de módulo sem necessidade real
- o mesmo filtro de data, empresa, competência ou status precisa ser reaplicado em várias telas
- a segunda tela funciona mais como detalhe, aba, painel lateral ou etapa do mesmo processo

As telas devem continuar separadas quando:

- atendem perfis muito diferentes
- exigem permissões muito distintas
- possuem alta complexidade própria e uso eventual
- representam administração técnica, não operação recorrente

---

## Propostas de Aglutinação por Fluxo

## 1. Central Operacional

### Telas atuais envolvidas

- `Processamento`
- `Importações`
- `Inconsistências`

### Problema atual

Essas três telas compõem um mesmo ciclo operacional:

1. trazer ou sincronizar dados
2. validar processamento
3. corrigir inconsistências
4. reprocessar se necessário

Hoje o usuário precisa sair de uma tela para outra para concluir uma única atividade operacional.

### Proposta

Transformar essas telas em uma única `Central Operacional`, com estrutura por abas ou blocos na mesma página:

- `Resumo do Dia`
- `Importações e Sincronizações`
- `Processamento`
- `Inconsistências`
- `Ações rápidas`

### Estrutura sugerida

- cabeçalho fixo com filtros globais de `data` e `empresa`
- card-resumo com:
  - quantidade de colaboradores
  - operações do dia
  - total processado
  - inconsistências
  - status da última importação
- aba ou seção `Importações`
  - histórico recente
  - importar CSV
  - sincronizar agora
- aba ou seção `Processamento`
  - visualizar dados de ponto e operações
  - processar dia
  - status do motor/IA
- aba ou seção `Inconsistências`
  - lista filtrada
  - correção inline ou via painel lateral
  - reprocessar após correção

### Ganhos esperados

- elimina a ida e volta entre menu e telas correlatas
- reduz tempo de resolução operacional
- mantém data e empresa persistidas durante todo o fluxo
- melhora entendimento do que falta para “concluir o dia”

### Prioridade

`Muito alta`

---

## 2. Central de Fechamento e Faturamento

### Telas atuais envolvidas

- `Financeiro Geral`
- `Faturamento por Cliente`
- `Fechamento Mensal`
- `Detalhamento do Cliente`
- `Detalhamento do Colaborador`

### Problema atual

O usuário financeiro trabalha por competência e por empresa. Hoje ele consulta uma visão geral em uma tela, aprova faturamento em outra, fecha período em outra e audita detalhes em páginas separadas.

Isso quebra o fluxo natural de fechamento.

### Proposta

Criar uma `Central de Fechamento` ou `Cockpit Financeiro por Competência`, agrupando:

- visão consolidada
- faturamento por cliente
- pendências e inconsistências
- auditoria financeira
- fechamento/reabertura

### Estrutura sugerida

- filtros globais:
  - competência
  - empresa
- topo com indicadores:
  - total faturável
  - clientes faturados
  - colaboradores impactados
  - inconsistências
  - status da competência
- bloco `Faturamento por Cliente`
  - lista principal
  - aprovação em lote
  - drill-down em drawer, não necessariamente nova página
- bloco `Auditoria / Memória de Cálculo`
  - detalhamento por cliente e colaborador em painel lateral ou aba
- bloco `Fechamento`
  - consolidar faturamento
  - fechar período
  - reabrir período
  - trilha de bloqueios e pendências

### Ganhos esperados

- transforma o fechamento em um fluxo único e rastreável
- evita perda de contexto ao investigar valores
- diminui número de páginas para uma tarefa crítica
- facilita aprovação e conferência em sequência

### Prioridade

`Muito alta`

---

## 3. Central Bancária

### Telas atuais envolvidas

- `Remessa CNAB`
- `Histórico de Remessas`
- `Retorno Bancário`

### Problema atual

Remessa, histórico e retorno são partes do mesmo processo bancário. Separar demais essas etapas faz o usuário perder visibilidade do ciclo completo.

### Proposta

Criar uma `Central Bancária` com fluxo orientado:

- `Preparar Remessa`
- `Validar`
- `Gerar Arquivo`
- `Histórico`
- `Importar/Processar Retorno`

### Estrutura sugerida

- filtros persistentes de competência, empresa e conta
- passo atual visível no topo
- painel de integridade e alertas
- histórico recente logo abaixo da geração
- retorno bancário como etapa seguinte do mesmo contexto

### Ganhos esperados

- visão ponta a ponta do processo bancário
- menos retrabalho ao conferir o que já foi enviado
- facilita reconciliação entre remessa e retorno

### Prioridade

`Alta`

---

## 4. Central de Cadastros Operacionais

### Telas atuais envolvidas

- `Colaboradores`
- `Empresas`
- `Coletores REP`
- partes de `Configurações Mínimas`

### Problema atual

Essas telas são administrativamente conectadas. Empresa impacta colaborador. Coletor depende de empresa. Configurações mínimas alteram comportamento operacional dessas entidades. Mesmo assim, o usuário navega entre áreas separadas.

### Proposta

Criar uma `Central de Cadastros`, com navegação interna por domínio:

- `Empresas`
- `Colaboradores`
- `Coletores`
- `Parâmetros Operacionais`

### Estrutura sugerida

- busca global única para cadastros
- filtros persistentes por empresa, status e tipo
- abertura de detalhe em drawer
- vínculos visíveis entre registros
  - empresa mostra colaboradores e coletores relacionados
  - colaborador mostra empresa, contrato e impacto financeiro

### Ganhos esperados

- menos navegação técnica
- maior visão relacional entre cadastros
- cadastro e conferência mais rápidos

### Prioridade

`Alta`

---

## 5. Central de Relatórios e Integrações

### Telas atuais envolvidas

- `Relatórios`
- `Agendamentos`
- `Layouts de Exportação`
- `Integração Contábil`
- `Mapeamento Contábil`
- `Logs de Integração`

### Problema atual

Hoje o hub de relatórios já concentra parte do fluxo, mas ainda há uma separação excessiva entre gerar, configurar, mapear, agendar e acompanhar integrações.

### Proposta

Evoluir a área atual para uma `Central de Relatórios e Integrações`, com camadas claras:

- `Catálogo`
- `Agendamentos`
- `Layouts`
- `Integrações`
- `Logs`

### Estrutura sugerida

- catálogo principal com busca
- painel lateral contextual para:
  - gerar agora
  - agendar
  - escolher layout
  - verificar integração relacionada
- dentro de `Integrações`, manter `Mapeamento` e `Logs` como subabas

### Ganhos esperados

- menos fragmentação entre gerar e distribuir relatórios
- melhor entendimento do fluxo de exportação
- acesso mais rápido a erro de integração após uma geração

### Prioridade

`Média/Alta`

---

## 6. Governança Unificada

### Telas atuais envolvidas

- `Gestão de Usuários`
- `Perfis e Permissões`
- `Auditoria`

### Problema atual

Essas telas já pertencem ao mesmo domínio, mas ainda podem ser percebidas como partes isoladas de administração.

### Proposta

Criar uma `Central de Governança` com três áreas internas:

- `Usuários`
- `Perfis e Permissões`
- `Auditoria`

### Estrutura sugerida

- ao abrir um usuário, exibir:
  - perfil vinculado
  - empresas de acesso
  - últimas ações relevantes
- ao editar um perfil, mostrar:
  - usuários impactados
  - módulos afetados
- auditoria com filtros pré-aplicáveis a partir de usuário, perfil ou ação

### Ganhos esperados

- reduz navegação investigativa
- melhora rastreabilidade de permissões e impactos
- fortalece segurança com contexto completo

### Prioridade

`Média`

---

## 7. Configurações: separar Preferências de Administração

### Situação atual

A tela de `Configurações` mistura:

- preferências pessoais
- perfil do usuário
- parâmetros operacionais
- cadastros mínimos do sistema

### Proposta

Dividir conceitualmente em duas camadas:

- `Meu Perfil e Preferências`
- `Administração Operacional`

### Recomendação prática

- manter `Meu Perfil` e `Preferências` dentro de `Configurações`
- mover `Configurações Mínimas` e `Parâmetros Básicos` para a `Central de Cadastros` ou `Administração Operacional`

### Ganhos esperados

- reduz confusão entre configuração pessoal e configuração sistêmica
- melhora segurança conceitual
- facilita aprendizado para novos usuários

### Prioridade

`Alta`

---

## Modelo de Navegação Recomendado

Em vez de um menu com muitas páginas independentes, a navegação ideal deve priorizar centrais de trabalho:

1. `Dashboard`
2. `Central Operacional`
3. `Central de Cadastros`
4. `Central Financeira`
5. `Central Bancária`
6. `Central de Relatórios e Integrações`
7. `Central de Governança`
8. `Portal do Cliente`
9. `Meu Perfil / Preferências`

Dentro de cada central, usar:

- abas
- painéis laterais
- drawers
- breadcrumbs simples
- filtros persistentes

Evitar abrir uma nova rota sempre que o usuário só precisa ver detalhe, corrigir item ou avançar para a próxima etapa do mesmo fluxo.

---

## Diretrizes de Produtividade

- Persistir filtros globais por contexto, como empresa, data e competência.
- Manter ações principais visíveis no topo da tela.
- Exibir próximos passos sugeridos, como `corrigir inconsistências antes de fechar`.
- Reduzir modais quando a ação exigir análise prolongada; preferir drawers ou painéis laterais.
- Permitir retorno rápido ao contexto anterior sem recarregar estado.
- Usar atalhos para ações recorrentes, como processar, aprovar, fechar, exportar.

---

## Diretrizes de Acessibilidade

- Garantir hierarquia visual clara entre objetivo da tela, filtros, dados e ações.
- Não depender apenas de cor para status; usar texto e ícones.
- Manter labels explícitos em filtros e botões.
- Preservar foco de teclado ao abrir e fechar modais, drawers e painéis.
- Padronizar nomes de ações para reduzir ambiguidade.
- Evitar telas com excesso de blocos equivalentes sem agrupamento visual.
- Garantir contraste forte em badges, status e alertas.
- Priorizar leitura linear em desktop e empilhamento coerente em mobile.

---

## Roadmap de Implementação

## Fase 1

- unir `Processamento`, `Importações` e `Inconsistências` em uma `Central Operacional`
- unir `Financeiro Geral`, `Faturamento` e `Fechamento` em uma `Central Financeira`
- mover detalhes financeiros para drawer/aba contextual

## Fase 2

- criar `Central Bancária`
- reorganizar `Configurações` separando preferências pessoais de administração operacional
- consolidar `Colaboradores`, `Empresas` e `Coletores` em `Central de Cadastros`

## Fase 3

- evoluir `Relatórios` para `Central de Relatórios e Integrações`
- consolidar `Governança` em fluxo mais contextual
- revisar menu lateral para refletir a nova arquitetura

---

## Critérios de Sucesso

O plano terá sucesso quando:

- o usuário precisar de menos cliques para concluir uma tarefa completa
- filtros não precisarem ser refeitos a cada troca de tela
- tarefas sequenciais puderem ser concluídas sem retorno ao menu
- a navegação passar a refletir objetivos de trabalho, e não apenas módulos técnicos
- novos usuários entenderem com mais facilidade “onde fazer cada coisa”

Indicadores recomendados:

- redução do número médio de navegações por tarefa
- redução do tempo para fechamento de competência
- redução do tempo para resolução de inconsistências
- aumento do uso de ações diretas dentro da mesma tela
- menor taxa de abandono/interrupção de fluxo

---

## Conclusão

Oportunidade principal: migrar de uma navegação orientada por módulos para uma navegação orientada por objetivos.

Hoje o ERP já possui os blocos funcionais corretos, mas eles estão mais separados do que o ideal para a rotina real dos usuários. A maior otimização virá da criação de centrais de trabalho que agrupem consulta, ação, correção e conclusão no mesmo contexto.

Em resumo, os melhores agrupamentos imediatos são:

- `Processamento + Importações + Inconsistências`
- `Financeiro Geral + Faturamento + Fechamento + Auditoria financeira`
- `Remessa + Histórico + Retorno`
- `Empresas + Colaboradores + Coletores + Parâmetros operacionais`
- `Relatórios + Agendamentos + Layouts + Integração + Logs`

Essas mudanças tendem a gerar ganho direto de produtividade, melhor compreensão do sistema e uma experiência de uso mais fluida e profissional.
