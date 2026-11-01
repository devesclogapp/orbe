import fs from 'node:fs';
import path from 'node:path';

const root = 'y:/2026/ERP ESC LOG/Orbe';

// -------------------------------------------------------------
// 1. UPDATE src/pages/Configuracoes.tsx
// -------------------------------------------------------------
{
  const filePath = path.join(root, 'src/pages/Configuracoes.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  // New config_operacional block
  const newConfigOperacional = `        <TabsContent value="config_operacional" className="space-y-5 mt-2">
          {/* Card 1: Motor Operacional */}
          <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-5 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
              <div>
                <h3 className="font-display font-semibold text-sm tracking-tight text-foreground flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Motor Operacional
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Regras que governam cálculo, conferência e comportamento dos fluxos operacionais do ERP.
                </p>
              </div>
              <Button
                variant={isEditingParams ? "default" : "outline"}
                size="sm"
                onClick={() => isEditingParams ? saveParamsMutation.mutate(paramsForm) : setIsEditingParams(true)}
                disabled={saveParamsMutation.isPending}
                className={cn(
                  "rounded-lg text-xs font-medium shrink-0 h-9 px-4 transition-all",
                  isEditingParams
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                    : "border-border/80 hover:bg-muted/40 text-foreground"
                )}
              >
                {saveParamsMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : isEditingParams ? (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                )}
                {isEditingParams ? "Salvar Alterações" : "Editar Parâmetros"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card Geral */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-display font-semibold text-xs text-foreground tracking-tight">Parâmetros Gerais</span>
                </div>
                <div className="space-y-1 divide-y divide-border/50">
                  <EditableParam
                    label="Moeda Padrão"
                    value={paramsForm.moeda_padrao || 'BRL (R$)'}
                    editing={isEditingParams}
                    onChange={v => setParamsForm({ ...paramsForm, moeda_padrao: v })}
                    options={["BRL (R$)", "USD ($)", "EUR (€)"]}
                  />
                  <EditableParam
                    label="Fuso Horário"
                    value={fixMojibakeText(paramsForm.fuso_horario || "GMT-3 (Brasília)")}
                    editing={isEditingParams}
                    onChange={v => setParamsForm({ ...paramsForm, fuso_horario: v })}
                    options={["GMT-3 (Brasília)", "GMT-4 (Manaus)", "GMT-0 (Londres)"]}
                  />
                  <EditableParam
                    label="Limite de Escopo (Dias)"
                    value={String(paramsForm.limite_escopo || 31)}
                    editing={isEditingParams}
                    type="number"
                    onChange={v => setParamsForm({ ...paramsForm, limite_escopo: Number(v) })}
                  />
                </div>
              </div>

              {/* Card Operacional */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-display font-semibold text-xs text-foreground tracking-tight">Regras de Apuração</span>
                </div>
                <div className="space-y-1 divide-y divide-border/50">
                  <EditableParam
                    label="Tolerância de Ponto (Minutos)"
                    value={String(paramsForm.tolerancia_ponto || 10)}
                    editing={isEditingParams}
                    type="number"
                    onChange={v => setParamsForm({ ...paramsForm, tolerancia_ponto: Number(v) })}
                  />
                  <EditableParam
                    label="Arredondamento Financeiro"
                    value={paramsForm.arredondamento_financeiro || 'Duas casas'}
                    editing={isEditingParams}
                    onChange={v => setParamsForm({ ...paramsForm, arredondamento_financeiro: v })}
                    options={["Duas casas", "Inteiro (Cêntimos)", "Teto"]}
                  />
                  <div className="flex items-center justify-between py-2 min-h-[48px]">
                    <span className="text-xs text-muted-foreground">Notificação de Inconsistência</span>
                    {isEditingParams ? (
                      <Switch
                        checked={paramsForm.notificacao_inconsistencia}
                        onCheckedChange={v => setParamsForm({ ...paramsForm, notificacao_inconsistencia: v })}
                      />
                    ) : (
                      <span className="text-xs font-semibold text-foreground">
                        {paramsForm.notificacao_inconsistencia ? 'Ativado' : 'Desativado'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Jornadas de Trabalho */}
          <JornadasTrabalhoSection />

          {/* Seção 3: Regras de Banco de Horas */}
          <RegrasBancoHorasSection />

          {/* Seção 4: Filtros de Colaboradores */}
          <div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-5 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border/60">
              <div className="space-y-0.5">
                <h3 className="font-display font-semibold text-sm tracking-tight text-foreground">
                  Filtros de colaboradores por tela do encarregado
                </h3>
                <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                  Cada fluxo decide de forma independente quais colaboradores podem ser carregados. Campos vazios significam sem restrição para aquele critério.
                </p>
                {!empresaId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Nenhuma empresa válida foi encontrada para salvar esta configuração.
                  </p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => saveParamsMutation.mutate(paramsForm)}
                disabled={saveParamsMutation.isPending || !empresaId}
                className="rounded-lg text-xs font-medium shrink-0 h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all gap-1.5"
              >
                {saveParamsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Salvar filtros
              </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {ENCARREGADO_FILTER_TARGETS.map((preset) => {
                const filter = presetFilters[preset.id];
                const availableOptions = getAvailableOptionsForField(filter.campo_filtro);

                return (
                  <div key={preset.id} className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3.5">
                    <div>
                      <h4 className="font-semibold text-xs text-foreground">{fixMojibakeText(preset.title)}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{fixMojibakeText(preset.description)}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground">Filtrar colaboradores por</Label>
                        {preset.fixed ? (
                          <div className="min-h-9 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-medium text-foreground flex items-center">
                            Tipo
                          </div>
                        ) : (
                          <Select
                            value={filter.campo_filtro || "tipo_contrato"}
                            onValueChange={(value) => updatePresetFilter(preset.id, { campo_filtro: value as "tipo_colaborador" | "tipo_contrato" })}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tipo_contrato" className="text-xs">Contrato</SelectItem>
                              <SelectItem value="tipo_colaborador" className="text-xs">Tipo</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-medium text-muted-foreground">Valores permitidos</Label>
                        {!preset.fixed ? (
                          <Select
                            value={filter.valores_filtro?.[0] || ""}
                            onValueChange={(value) => updatePresetFilter(preset.id, { valores_filtro: value ? [value] : [] })}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg bg-background">
                              <SelectValue placeholder="Selecione uma opção disponível" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableOptions.map((option) => (
                                <SelectItem key={option} value={option} className="text-xs">
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="min-h-9 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-medium text-foreground flex items-center">
                            {preset.fixed ? "DIARISTA" : formatFilterList(filter.valores_filtro)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>`;

  // New modelos block
  const newModelos = `        <TabsContent value="modelos" className="space-y-4 mt-2">
          {/* Header Card */}
          <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-display font-semibold text-sm tracking-tight text-foreground">
                  Modelos de Importação
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Cadastre links de planilhas de referência do Google Drive para download nos assistentes de importação.
              </p>
            </div>
            <Button
              onClick={handleAddImportTemplate}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shrink-0 h-9 px-3.5 shadow-xs transition-all gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Modelo
            </Button>
          </div>

          {/* Tabela de Modelos */}
          <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-left">
                    <th className="px-5 py-3">Módulo</th>
                    <th className="px-4 py-3">Nome do arquivo</th>
                    <th className="px-4 py-3">Link do Drive</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loadingModelos ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2 text-blue-600" />
                        Carregando modelos...
                      </td>
                    </tr>
                  ) : importacaoModelos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
                            <Database className="h-5 w-5" />
                          </div>
                          <p className="text-xs font-medium text-foreground">Nenhum modelo configurado</p>
                          <p className="text-[11px] text-muted-foreground max-w-sm">
                            Adicione links de planilhas para disponibilizar aos usuários nas rotinas de importação.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    importacaoModelos.map((item: any) => {
                      const moduloLabel = IMPORTACAO_MODULOS.find((modulo) => modulo.value === item.modulo)?.label || item.modulo;
                      return (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-foreground">{moduloLabel}</td>
                          <td className="px-4 py-3.5 text-muted-foreground">{item.nome_arquivo || "Não informado"}</td>
                          <td className="px-4 py-3.5 text-muted-foreground">
                            <a
                              href={item.drive_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              <Globe className="h-3.5 w-3.5 text-blue-500" />
                              Abrir Planilha
                            </a>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {item.ativo ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/60">
                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                                Inativo
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                onClick={() => window.open(item.drive_url, "_blank", "noopener,noreferrer")}
                                title="Abrir no Google Drive"
                              >
                                <Globe className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                onClick={() => handleEditImportTemplate(item)}
                                title="Editar modelo"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                onClick={() => {
                                  if (confirm("Deseja remover este modelo de importação?")) {
                                    deleteImportTemplateMutation.mutate(item.id);
                                  }
                                }}
                                title="Remover modelo"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>`;

  // New Dialog
  const newDialog = `      <Dialog open={importTemplateModalOpen} onOpenChange={setImportTemplateModalOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-xl border border-border/80 bg-card p-6 shadow-lg">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold text-base tracking-tight text-foreground">
              {editingImportTemplate ? "Editar modelo de importação" : "Novo modelo de importação"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Módulo</Label>
              <Select
                value={importTemplateForm.modulo}
                onValueChange={(value) => setImportTemplateForm({ ...importTemplateForm, modulo: value })}
              >
                <SelectTrigger className="h-9 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTACAO_MODULOS.map((modulo) => (
                    <SelectItem key={modulo.value} value={modulo.value} className="text-xs">{modulo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Nome do arquivo</Label>
              <Input
                value={importTemplateForm.nome_arquivo}
                onChange={(e) => setImportTemplateForm({ ...importTemplateForm, nome_arquivo: e.target.value })}
                placeholder="Ex: modelo_transportadoras.xlsx"
                className="h-9 text-xs rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Link do Google Drive</Label>
              <Input
                value={importTemplateForm.drive_url}
                onChange={(e) => setImportTemplateForm({ ...importTemplateForm, drive_url: e.target.value })}
                placeholder="https://drive.google.com/..."
                className="h-9 text-xs rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 p-3 pt-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium text-foreground">Modelo ativo</Label>
                <p className="text-[11px] text-muted-foreground">Disponível para download nos assistentes</p>
              </div>
              <Switch
                checked={importTemplateForm.ativo}
                onCheckedChange={(checked) => setImportTemplateForm({ ...importTemplateForm, ativo: checked })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportTemplateModalOpen(false)}
              className="rounded-lg text-xs font-medium border-border/80 hover:bg-muted/40 h-9"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => importTemplateMutation.mutate(importTemplateForm)}
              disabled={importTemplateMutation.isPending || !importTemplateForm.drive_url}
              className="rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-xs h-9 px-4"
            >
              {importTemplateMutation.isPending ? "Salvando..." : "Salvar Modelo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>`;

  // Find boundaries in content
  // First, normalize line endings in memory to replace cleanly
  const crlf = content.includes('\r\n');
  const normalized = content.replace(/\r\n/g, '\n');

  // Regex for config_operacional TabsContent
  const configOpRegex = /<TabsContent value="config_operacional"[\s\S]*?<\/TabsContent>/;
  const modelosRegex = /<TabsContent value="modelos"[\s\S]*?<\/TabsContent>/;
  const dialogRegex = /<Dialog open=\{importTemplateModalOpen\}[\s\S]*?<\/Dialog>/;

  let replaced = normalized.replace(configOpRegex, newConfigOperacional.replace(/\r\n/g, '\n'));
  replaced = replaced.replace(modelosRegex, newModelos.replace(/\r\n/g, '\n'));
  replaced = replaced.replace(dialogRegex, newDialog.replace(/\r\n/g, '\n'));

  // Put CRLF back if original was CRLF
  if (crlf) {
    replaced = replaced.replace(/\n/g, '\r\n');
  }

  fs.writeFileSync(filePath, replaced, 'utf8');
  console.log('Updated src/pages/Configuracoes.tsx successfully');
}

// -------------------------------------------------------------
// 2. UPDATE src/pages/Configuracoes/JornadasTrabalhoSection.tsx
// -------------------------------------------------------------
{
  const filePath = path.join(root, 'src/pages/Configuracoes/JornadasTrabalhoSection.tsx');
  let content = fs.readFileSync(filePath, 'utf8');
  const crlf = content.includes('\r\n');
  let normalized = content.replace(/\r\n/g, '\n');

  // Replace outer esc-card
  normalized = normalized.replace(
    '<section className="esc-card p-6 mt-6 space-y-6">',
    '<section className="rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-5 transition-colors">'
  );

  if (crlf) {
    normalized = normalized.replace(/\n/g, '\r\n');
  }

  fs.writeFileSync(filePath, normalized, 'utf8');
  console.log('Updated JornadasTrabalhoSection.tsx successfully');
}

// -------------------------------------------------------------
// 3. UPDATE src/pages/Configuracoes/RegrasBancoHorasSection.tsx
// -------------------------------------------------------------
{
  const filePath = path.join(root, 'src/pages/Configuracoes/RegrasBancoHorasSection.tsx');
  let content = fs.readFileSync(filePath, 'utf8');
  const crlf = content.includes('\r\n');
  let normalized = content.replace(/\r\n/g, '\n');

  // Replace outer esc-card
  normalized = normalized.replace(
    '<section id="regras-banco-horas" className="esc-card p-6 mt-6 space-y-6">',
    '<section id="regras-banco-horas" className="rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-5 transition-colors">'
  );

  // Replace thead esc-table-header
  normalized = normalized.replace(
    '<thead className="esc-table-header">',
    '<thead className="bg-muted/40 border-b border-border/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">'
  );

  if (crlf) {
    normalized = normalized.replace(/\n/g, '\r\n');
  }

  fs.writeFileSync(filePath, normalized, 'utf8');
  console.log('Updated RegrasBancoHorasSection.tsx successfully');
}

// -------------------------------------------------------------
// 4. UPDATE src/pages/Configuracoes/ResetOperacional.tsx
// -------------------------------------------------------------
{
  const filePath = path.join(root, 'src/pages/Configuracoes/ResetOperacional.tsx');
  let content = fs.readFileSync(filePath, 'utf8');
  const crlf = content.includes('\r\n');
  let normalized = content.replace(/\r\n/g, '\n');

  // Replace header section esc-card
  const oldHeaderPattern = /<section className="esc-card p-5">[\s\S]*?<\/section>/;
  const newHeader = `<div className="rounded-xl border border-border/80 bg-card p-6 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="h-3 w-3" />
                Área Restrita — Operações Críticas
              </span>
            </div>
            <div>
              <h2 className="font-display font-semibold text-base tracking-tight text-foreground">
                Manutenção do Ambiente & Resets Transacionais
              </h2>
              <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed mt-1">
                Reinicialize escopos transacionais do tenant <strong className="text-foreground">{tenant?.name ?? "atual"}</strong> preservando sempre
                tenant, perfis, autenticação, permissões e auditoria sistêmica. O nível <strong className="text-foreground">Reset Ambiente Demo</strong>
                também remove cadastros mestres, regras operacionais e contas bancárias do tenant.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 max-w-md shrink-0 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-foreground">Dupla Proteção Obrigatória</div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Toda execução exige justificativa, confirmação textual exata, auditoria persistente em múltiplas trilhas e
                validação explícita do tenant.
              </p>
            </div>
          </div>
        </div>
      </div>`;

  normalized = normalized.replace(oldHeaderPattern, newHeader);

  if (crlf) {
    normalized = normalized.replace(/\n/g, '\r\n');
  }

  fs.writeFileSync(filePath, normalized, 'utf8');
  console.log('Updated ResetOperacional.tsx successfully');
}
