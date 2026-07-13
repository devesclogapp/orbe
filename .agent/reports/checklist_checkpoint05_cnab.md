# Checkpoint 05 - Geração da Remessa CNAB240 (Intermitentes)
## Checklist de Revalidação Oficial

- [ ] Lote aparece naturalmente na Central Bancária
- [ ] Lote pertence à empresa correta
- [ ] Status é FECHADO_FINANCEIRO
- [ ] Nenhum caso de `empresa_id = null`
- [ ] Dados bancários validados e ausências apontadas/bloqueadas
- [ ] Geração do arquivo CNAB240 com sucesso
- [ ] Estrutura do arquivo CNAB240 conforme FEBRABAN
- [ ] Arquivo Cnab registrado em `cnab_remessas_arquivos` com vínculo correto
- [ ] Sistema impede geração de segunda remessa para o mesmo lote
- [ ] Auditoria (logs, actions, time, user) completa e íntegra
