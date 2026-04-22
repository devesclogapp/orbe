# Mapeamento Detalhado: Módulo de Relatórios

Este documento apresenta a auditoria funcional de todos os botões e opções interativas do módulo de Relatórios e suas sub-telas.

## Resumo de Funcionalidades e Status

| Tela | Elemento | Ação | Status | Notas Técnicas |
| :--- | :--- | :--- | :--- | :--- |
| **Hub** | Agendamentos | Navegação | ✅ Funcionando | Navega para sub-tela de recorrência. |
| **Hub** | Layouts | Navegação | ✅ Funcionando | Navega para editor de layouts. |
| **Hub** | Integração | Navegação | ✅ Funcionando | Navega para painel contábil. |
| **Hub** | Estrela (Favorito) | Toggle Favorito | ✅ Funcionando | Mutation real no Supabase (`relatorios_favoritos`). |
| **Hub** | Play (Gerar) | Execução Rápida | ⚠️ Parcial | Gatilho visual (Toast). O download real ocorre no Detalhe. |
| **Agendamentos** | Novo Agendamento | Abrir Modal | ✅ Funcionando | Aciona `Dialog` de configuração completo. |
| **Agendamentos** | Salvar | Persistência | ✅ Funcionando | Mutation real no Supabase (`relatorios_agendamentos`). |
| **Agendamentos** | Executar Agora | Gatilho Manual | ⚠️ Simulado | Simulação de 1.5s com feedback de sucesso. |
| **Agendamentos** | Ver Logs / Excluir | Menu Ações | ❌ Visual | Itens de Dropdown sem handlers implementados. |
| **Integração** | Envio Mensal | Trigger API | ✅ Funcionando | Insere log real de execução no Supabase. |
| **Integração** | Sincronia Rápida | Trigger API | ✅ Funcionando | Insere log real de execução no Supabase. |
| **Integração** | Configurar Nova | Adicionar Sistema | ❌ Visual | Botão sem handler de ação ou formulário. |
| **Layouts** | Criar Novo | Novo Cadastro | ❌ Visual | Botão no topo sem handler. |
| **Layouts** | Ações de Card | Edit/Copy/Del | ❌ Visual | Ícones interativos sem lógica de backend. |
| **Detalhe** | Exportar EXCEL | Download | ✅ Funcionando | Gera arquivo `.csv` formatado via Blob local. |
| **Detalhe** | Agendar | Atalho | ✅ Funcionando | Redireciona para o fluxo de agendamento. |
| **Detalhe** | Editar Filtros | Filtro | ❌ Visual | Botão presente mas sem lógica de filtragem dinâmica. |
| **Detalhe** | Troca Visualização | Grid/Table | ✅ Funcionando | Estado local alterna renderização do dataset. |
| **Mapeamento** | Novo Mapeamento | Cadastro | ❌ Visual | Botão sem handler de formulário. |
| **Logs** | Detalhe | Ver Detalhe | ❌ Visual | Botão presente mas sem abrir visualizador. |

## Diagnóstico de Estabilização

1.  **Persistência Base**: Todas as listagens (Catalog, Agendamentos, Layouts, Logs, Mapeamento) estão conectadas ao Supabase via `ReportService` e `AccountingService`.
2.  **Fluxos Críticos**: A geração de relatórios (Exportar Excel) e os Gatilhos de Integração Contábil estão 100% funcionais.
3.  **Lacunas Identificadas**: Diversos botões de "CRUD Secundário" (Excluir agendamento, Criar novo Layout, Detalhes de Log) estão em estágio de interface (UI-Only), aguardando implementação dos modais ou handlers de serviço.

---
*Relatório gerado automaticamente pela ProjectStabilizerSkill em 22/04/2024.*
