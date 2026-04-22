# Mapeamento de Botões e Opções - ERP Orbe

Este documento detalha todos os elementos interativos, gatilhos de ação e opções de navegação mapeados no ERP Orbe, correlacionados aos módulos do sistema e ao Design System.

---

## 1. Elementos Globais (AppShell)

### Sidebar (Navegação Lateral)
- **Menu de Navegação**: NavLinks para todos os módulos principais.
  - `Dashboard`: Visão geral métricas.
  - `Processamento`: Unidade de processamento operacional.
  - `Inconsistências`: Gestão de erros e correções.
  - `Colaboradores`: Cadastro e gestão de RH.
  - `Empresas`: Gestão de unidades e empresas.
  - `Financeiro`: Regras, faturamento e remessas.
  - `Relatórios`: Hub de exportação e agendamentos.
  - `Governança`: Usuários, perfis e auditoria.
- **Perfil do Usuário**: Acesso rápido às configurações de conta.
- **Botão Sair**: Encerra a sessão do usuário.

### Topbar (Barra Superior)
- **Busca de Comando (Ctrl+K)**: Atalho para busca global no app.
- **Alternar Tema**: Botão para trocar entre modo claro e escuro.
- **Notificações**: Sino com indicador de alertas pendentes.
- **IA Assistente**: Botão flutuante ou na barra para acionar suporte inteligente.

---

## 2. Dashboard

- **Filtro de Período**: Seleção de mês/ano para visualização dos dados.
- **Cards de Métricas**: Elementos clicáveis que levam aos módulos específicos (ex: clique em "Pendências" abre Inconsistências).
- **Gráficos Interativos**: Legendas filtráveis para alternar visualização de séries.

---

## 3. Processamento Operacional

- **Barra de Filtros**:
  - `Data`: Selecionador de competência.
  - `Empresa`: Filtro por unidade.
- **Botões de Ação Principal**:
  - `Processar com IA`: Inicia o motor de processamento inteligente.
  - `Reabrir Período`: (Admin) Permite reprocessar dados de meses fechados.
- **Blocos de Dados (Ponto e Operações)**:
  - Abas de alternância entre `Ponto` e `Operações`.
  - Botão `Expandir`: Abre a linha para ver detalhes técnicos.
  - Botões de Status: Ícones que indicam Sucesso, Alerta ou Erro (frequentemente clicáveis para ações de correção).

---

## 4. Inconsistências e Correções

- **Lista de Erros**:
  - Botão `Corrigir`: Abre o painel lateral (RightPanel) para ajuste manual.
  - Botão `Ignorar`: Marca o erro como aceito (exige perfil Admin/RH).
- **Painel de Justificativa (Override)**:
  - Campo de Texto: Motivo da alteração manual.
  - Botão `Confirmar Correção`: Salva a alteração como Override Administrativo com log de auditoria.
  - Botão `Cancelar`: Fecha o modal sem salvar.

---

## 5. Colaboradores

- **Barra de Ferramentas**:
  - `Busca`: Input para filtrar por nome ou matrícula.
  - `Filtro Empresa`: Select para filtrar por unidade.
  - `Filtro Contrato`: Select para filtrar por tipo (Hora/Operação).
  - `Alternar Visualização`: Botões para trocar entre Tabela (List) e Grade (Grid).
  - `Atualizar`: Botão com ícone para recarregar a lista.
  - `Novo colaborador`: Botão para abrir o formulário de cadastro.
- **Tabela/Grade**:
  - Botão `Editar` (Lápis): Abre o modal com os dados carregados para alteração.
  - Botão `Excluir` (Lixeira): Abre confirmação de exclusão.
- **Modal de Cadastro/Edição**:
  - Campos: Nome, Cargo, Matrícula, Empresa, Tipo de Contrato, Valor Base.
  - Switch `Gera faturamento`: Ativa/Desativa inclusão no financeiro.
  - Botão `Salvar/Cadastrar`: Envia os dados para o Supabase.
  - Botão `Cancelar`: Fecha o modal.

---

## 6. Empresas

- **Barra de Ferramentas**:
  - `Alternar Visualização`: Grade (Grid) ou Tabela (List).
  - `Atualizar`: Recarrega a lista.
  - `Nova empresa`: Abre o formulário de cadastro.
- **Cards de Unidade (Grid)**:
  - Botão `Editar`: Abre modal de edição.
  - Botão `Excluir`: Remove a empresa (com aviso de impacto).
  - Estatísticas: Exibe contagem de Colaboradores e Coletores.
- **Modal de Empresa**:
  - Campos: Nome, CNPJ, Unidade (Filial), Cidade, Estado (UF).

---

## 7. Coletores REP

- **Barra de Ferramentas**:
  - `Alternar Visualização`: Grade ou Tabela.
  - `Cadastrar coletor`: Abre o formulário de registro.
- **Listagem**:
  - `Status`: Chips indicando Online, Offline ou Erro (indicadores visuais de monitoramento).
  - `Última Sync`: Exibe timestamp da última comunicação.
- **Modal de Coletor**:
  - Campos: Modelo, Série, Empresa vinculada.

---

## 8. Financeiro

### Regras de Cálculo
- **Filtros**: Select para filtrar regras por `Cliente`.
- **Botão `Nova Regra`**: Abre o formulário de criação.
- **Cards de Regra**:
  - Badge de Status: Ativo/Inativo.
  - Ícone de Balança (`Scale`): Identifica tipo (Adicional/Desconto).
  - Botão `Editar` (Lápis): Permite alterar parâmetros da regra.
  - Botão `Excluir` (Lixeira): Remove a regra do sistema.
- **Modal de Regra**:
  - Campos: Nome, Tipo, Valor (R$), Cliente Vinculado, Status.

### Faturamento por Cliente
- **Barra de Ações**:
  - `Busca`: Campo para localizar cliente por nome.
  - `Filtro Empresa`: Select para restringir faturamentos a uma unidade.
  - Botão `Imprimir Tudo`: Aciona comando do navegador para geração de PDF/Impressão.
  - Botão `Aprovar Lote`: Realiza a aprovação em massa de faturamentos filtrados.
- **Tabela de Faturamento**:
  - Botão `Memória` (`ExternalLink`): Navega para o detalhamento individual e memória de cálculo do cliente.
  - Badges de Status: Pendente/Aprovado.

### Remessa CNAB
- **Painel de Configuração**:
  - Select `Competência`: Escolha do mês/ano para geração.
  - Select `Empresa (Cliente)`: Unidade operacional emissora.
  - Select `Conta Bancária`: Conta de origem da remessa.
  - Botão `Validar Remessa`: Verifica integridade dos dados e exibe o resumo financeiro.
- **Painel de Resumo**:
  - Cards de Totais: Qtd de Títulos e Valor Total calculado.
  - Checklist de Integridade: Alertas técnicos ou confirmação de sucesso.
  - Botão `Gerar Arquivo CNAB (240)`: Inicia o download do arquivo de remessa formatado.

---

## 9. Relatórios

- **Barra de Busca**: Procura relatórios por nome ou categoria específica.
- **Atalhos Rápidos**:
  - Botões para `Agendamentos`, `Layouts` e `Integração Contábil`.
- **Categorias (Sidebar)**: Filtros rápidos para Operacional, Financeiro, Auditoria, Banco de Horas, etc.
- **Cards de Relatórios**:
  - Botão `Favorito` (Estrela): Fixa relatório na lista de acesso rápido.
  - Botão `Gerar` (`Play`): Executa o processamento imediato do relatório.
  - Badges: Indicam formatos de saída disponíveis (PDF, CSV, XLS).

---

## 10. Governança

### Gestão de Usuários
- **Controle de Visualização**: Alterna entre Tabela e Grade para gestão de acessos.
- **Botão `Vincular Usuário`**: Abre modal para associar ID de usuário (Auth) a um perfil e empresa.
- **Tabela/Grade**:
  - Botões `Editar` e `Remover` vínculos de acesso.
  - `StatusChip`: Indica o estado operacional do usuário (Ativo/Inativo).

### Perfis e Permissões
- **Lista de Perfis**: Permite selecionar um perfil para gerenciar permissões granulares.
- **Matriz de Permissões**: 
  - Tabela com cruzamento de Módulos vs Ações (Ver, Editar, Excluir, Aprovar).
  - Botões de Check/X: Alternam as permissões vigentes.
  - Botão `Salvar Alterações`: Persiste as novas regras de RBAC no banco de dados.

### Auditoria
- **Filtros Avançados**: Busca textual, filtro por Módulo e por Impacto (Crítico, Médio, Baixo).
- **Botão `Exportar CSV`**: Gera download da trilha de auditoria filtrada.
- **Ações**:
  - Botão `Ver JSON`: Abre modal com o log técnico (Payload) completo da ação para análise forense.

---

## 11. Portal do Cliente (Visão Externa)

- **Cards de KPI**:
  - `Faturado`: Exibe o valor do mês atual faturado.
  - `Aguardando Aprovação`: Atalho para o fluxo de aprovação do cliente.
- **Histórico de Fechamentos**: Lista os últimos faturamentos consolidados com acesso direto ao detalhamento.
- **Botões de Navegação**: Links rápidos para relatórios e suporte técnico exclusivo do cliente.
