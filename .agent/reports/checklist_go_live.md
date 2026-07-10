# Checklist Final para Virada de Chave (Go-Live)
**Ação Final de Operação para o ORBE**

### Checklist de Procedimentos Pré-Operação 🚀

- [ ] 1. **Ativação de Ambientes**
  - Checar chaves (`.env.production`) no provedor (Vercel/Cloudflare).
  - Validar instâncias do Supabase Production e URLs do N8N para Workflows Ativos.

- [ ] 2. **Limpeza da Base Oficial de Homologação (Sanitização Final)**
  - Foi estipulado que a Base de HML será mantida apenas como *migration/documento isolado*. As tabelas operacionais em PRD serão vazias e dependentes da implantação real. 
  - (Excluir os dados gerados via `limpeza_final_go_live.sql` sem afetar tabelas de estrutura/tipos genéricos).

- [ ] 3. **Definição do Super-Admin (Tenant Root)**
  - Confirmar que o e-mail master da ESC LOG possui perfil de sistema completo, que fará o onboarding dos supervisores.

- [ ] 4. **Teste de Sanidade RLS Final**
  - Efetuar 1 login padrão como *Encarregado* e garantir visualização zerada de fluxos RH/Financeiros.

- [ ] 5. **Deploy Frontend & Warmup Edge Functions**
  - O Build está empacotado perfeitamente; efetuar o trigger de produção no servidor CDN de frontend do ORBE.
  
- [ ] 6. **Backup da Fase Anterior**
  - Todas as documentações (`auditoria_*.md`) foram anexadas em `.agent/reports` para governança perpétua.

O ERP transita de Estágio HML para GO-LIVE Operacional no próximo "start".
Boa operação.
