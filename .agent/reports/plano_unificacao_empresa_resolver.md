# Checklist e Plano Diretor Técnico (PDT) — Empresa Resolver

## 📑 Avaliação Exaustiva (Checklist)
- [x] O **Mapeamento de Entrada** revelou 3 fontes com tratativas automáticas sujas e 4 de tela (limpas).
- [x] A **Divergência Analisada** expõe a criação de `Empresa(s)` fake nas importações de planilhas/RHID contra `null` fallback do Tio Digital.
- [x] Os **Riscos** listados confirmam fragmentação catastrófica em CNAB/Fechamentos/UI.
- [x] O **Novo Paradigma** foi definido como "Tabela de Aliases e bloqueio RPC".

---
## 🗺️ Plano de Unificação por Etapas e Sprints
*(Orientação à Equipe Técnica que assumirá as alterações subsequentes, garantindo zero trauma de migração)*

### **FASE 1 — Setup de Regulação Estrutural**
1. **Migration (DDL):** Criar tabela `empresas_aliases` (`id`, `tenant_id`, `empresa_id`, `alias_nom`).
2. **Domain/RPC:** Elaborar e publicar a PostgreSQL Function `resolve_empresa(alias_texto, tenant)` para abstrair na rede toda a checagem com um `fallback => exception`.
3. Modificar regras lógicas no Supabase para isolar acessos a gravação cega em empresas, protegendo e bloqueando de inserts aleatórios provenientes das automações.

### **FASE 2 — Faxina (Data Sanitization)**
1. Levantar por SQL todas as empresas provisórias que o sistema gerou (via "RHID" e "Manual").
2. Realizar Update Cascading para um UUID canônico (a Empresa Matriz correspondente) em registros de ponte (Colaboradores, Lançamentos, Fechamentos).
3. Efetuar limpeza expurgativa (Soft-Delete) na empresa fake.

### **FASE 3 — Hardening das Entradas (Edge Functions)**
1. Atualizar e homologar o arquivo `/supabase/functions/importar-pontos-rhid` conectando na Função RPC.
2. Atualizar `/supabase/functions/importar-intermitentes-tio`.
3. Atualizar `/supabase/functions/importar-pontos-manual`.
4. Os Webhooks deverão capturar o erro da RPC e, antes de devolver bad requests generalizados, salvar a notificação de inconsistência isolando a linha da importação.

### **FASE 4 — Capacitação Front-End**
1. Implantar aba *"Empresas Desconhecidas"* dentro da Área Gestão do ERP.
2. Implementar visualização dos alias aguardando pareamento e botão *"Vincular a uma Unidade Oficial"*.
3. Efetuar homologação real de stress de importações duplas.
