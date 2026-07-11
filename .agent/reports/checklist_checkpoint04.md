# CHECKLIST — CHECKPOINT 04 (APROVAÇÃO FINANCEIRA)
## INTERMITENTES

- [x] Lote com status `VALIDADO_RH` entra automaticamente na fila. *(Lote detectado via DB)*
- [ ] O Lote é visível para o gestor financeiro visualizar valor e registros. *(Falha no front - empresa nula barrada no filtro)*
- [x] Integridade mantida: Total valor, Total registros, Total de Horas, Status correto.
- [x] Botão Aprovar interage sem duplicidade (loading/bloqueio simulado).
- [x] O Status do Header do Lote avança de `VALIDADO_RH` -> `FECHADO_FINANCEIRO`.
- [x] Os registros filhos migram de `APROVADO_RH` -> `ENVIADO_FINANCEIRO`.
- [x] Rastreabilidade da ação armazenada no banco. *(Auditoria parcial: apenas filhos logados)*
- [x] O lote atualizado passa a figurar nas áreas de remessas e pagamentos.

**Conclusão do Checklist:** Incompleto por falha de interface impeditiva para o usuário.
