import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Ban,
  Check,
  ChevronsUpDown,
  Pencil,
  Plus,
  Save,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useClient } from "@/contexts/ClientContext";
import { cn } from "@/lib/utils";
import {
  EmpresaService,
  FormaPagamentoOperacionalService,
  FornecedorService,
  PerfilUsuarioService,
  ProdutoCargaService,
  RegraOperacionalService,
  TipoServicoOperacionalService,
  TransportadoraClienteService,
  TipoRegraOperacionalService,
} from "@/services/base.service";

type LookupItem = {
  id: string;
  nome: string;
  [key: string]: any;
};

type FormState = {
  empresa_id: string;
  tipo_servico_id: string;
  transportadora_id: string;
  fornecedor_id: string;
  produto_carga_id: string;
  tipo_regra_id: string;
  tipo_calculo: string;
  valor_unitario: string;
  forma_pagamento_id: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  status: "ativo" | "inativo";
};

type QuickCreateType = "tipo_servico" | "transportadora" | "fornecedor" | "produto" | "forma_pagamento" | "tipo_regra";

type QuickCreateState = {
  type: QuickCreateType;
  suggestedName: string;
} | null;

const TIPOS_CALCULO = [
  { value: "volume", label: "Por volume" },
  { value: "daily", label: "Por diária" },
  { value: "operation", label: "Por operação" },
  { value: "colaborador", label: "Por colaborador" },
];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
];

const EMPTY_FORM: FormState = {
  empresa_id: "",
  tipo_servico_id: "",
  transportadora_id: "",
  fornecedor_id: "",
  produto_carga_id: "",
  tipo_regra_id: "",
  tipo_calculo: "",
  valor_unitario: "",
  forma_pagamento_id: "",
  vigencia_inicio: new Date().toISOString().slice(0, 10),
  vigencia_fim: "",
  status: "ativo",
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ltda|me|eireli|sa|s\/a|transportes|transportadora|cliente|logistica|logistica|geral)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return "Sem fim";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const getTipoCalculoLabel = (tipo?: string | null) =>
  TIPOS_CALCULO.find((item) => item.value === tipo)?.label ?? "Não definido";

const normalizeOptionalId = (value: string) => (value ? value : null);

const isIssRuleDefinition = (rule?: { nome?: string | null; coluna_planilha?: string | null } | null) => {
  if (!rule) return false;

  const joined = `${rule.nome ?? ""} ${rule.coluna_planilha ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  return joined.includes("ISS");
};

const buildRuleDedupKey = (item: any) =>
  [
    item.tipo_regra_id ?? "",
    item.valor_unitario ?? "",
    item.tipo_calculo ?? "",
    item.vigencia_inicio ?? "",
    item.vigencia_fim ?? "",
    item.ativo ?? "",
    item.forma_pagamento_id ?? "",
    item.empresa_id ?? "",
    item.tipo_servico_id ?? "",
    item.fornecedor_id ?? "",
    item.transportadora_id ?? "",
    item.produto_carga_id ?? "",
  ].join("|");

const getSimilarItems = (items: LookupItem[], name: string) => {
  const normalizedTarget = normalizeText(name);
  if (!normalizedTarget) return [];

  return items.filter((item) => {
    const normalizedItem = normalizeText(item.nome ?? "");
    return (
      normalizedItem === normalizedTarget ||
      normalizedItem.includes(normalizedTarget) ||
      normalizedTarget.includes(normalizedItem)
    );
  });
};

type QuickCreateLookupProps = {
  label: string;
  placeholder: string;
  value: string;
  items: LookupItem[];
  disabled?: boolean;
  emptyOptionLabel?: string;
  noResultsLabel?: string;
  createLabel?: string;
  onChange: (value: string) => void;
  onCreate: (searchTerm: string) => void;
};

const QuickCreateLookup = ({
  label,
  placeholder,
  value,
  items,
  disabled,
  emptyOptionLabel,
  noResultsLabel,
  createLabel,
  onChange,
  onCreate,
}: QuickCreateLookupProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  const runCreate = (searchTerm: string) => {
    onCreate(searchTerm);
    setOpen(false);
  };

  const normalizedSearch = normalizeText(search);
  const selectedItem = items.find((item) => item.id === value) ?? null;

  const filteredItems = useMemo(() => {
    if (!normalizedSearch) return items;
    return items.filter((item) => normalizeText(item.nome).includes(normalizedSearch));
  }, [items, normalizedSearch]);

  const hasExactMatch = useMemo(
    () => items.some((item) => normalizeText(item.nome) === normalizedSearch),
    [items, normalizedSearch],
  );

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={disabled}
          onClick={() => onCreate("")}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {createLabel ?? "Novo"}
        </Button>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {selectedItem?.nome ?? (value === "" && emptyOptionLabel ? emptyOptionLabel : placeholder)}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Buscar ${label.toLowerCase()}...`}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {emptyOptionLabel && (
                <CommandGroup heading="Opções">
                  <CommandItem
                    value="__empty__"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectValue("")}
                    onSelect={() => selectValue("")}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === "" ? "opacity-100" : "opacity-0")} />
                    {emptyOptionLabel}
                  </CommandItem>
                </CommandGroup>
              )}

              <CommandGroup heading="Encontrados">
                {filteredItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectValue(item.id)}
                    onSelect={() => selectValue(item.id)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                    {item.nome}
                  </CommandItem>
                ))}
              </CommandGroup>

              {filteredItems.length === 0 && !search.trim() && (
                <CommandEmpty>{noResultsLabel ?? "Nenhum item encontrado."}</CommandEmpty>
              )}

              {!!search.trim() && !hasExactMatch && (
                <CommandGroup heading="Ação rápida">
                  <CommandItem
                    value={`create-${search}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runCreate(search.trim())}
                    onSelect={() => runCreate(search.trim())}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {`Cadastrar novo: ${search.trim()}`}
                  </CommandItem>
                </CommandGroup>
              )}

              {!search.trim() && (
                <CommandGroup heading="Ação rápida">
                  <CommandItem
                    value={`create-empty-${label}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runCreate("")}
                    onSelect={() => runCreate("")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {createLabel ? `Cadastrar ${createLabel.toLowerCase()}` : "Cadastrar novo"}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const RegrasOperacionais = () => {
  const { user } = useAuth();
  const { userRole, isLoading: isLoadingRole } = useClient();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [applyGlobally, setApplyGlobally] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [quickCreate, setQuickCreate] = useState<QuickCreateState>(null);
  const [transportadoraDraft, setTransportadoraDraft] = useState({
    nome: "",
    tipo_cadastro: "transportadora",
    documento: "",
  });
  const [tipoServicoDraft, setTipoServicoDraft] = useState({
    nome: "",
    descricao: "",
  });
  const [fornecedorDraft, setFornecedorDraft] = useState({
    nome: "",
    documento: "",
  });
  const [produtoDraft, setProdutoDraft] = useState({
    nome: "",
    categoria: "",
  });
  const [formaPagamentoDraft, setFormaPagamentoDraft] = useState({
    nome: "",
  });
  const [tipoRegraDraft, setTipoRegraDraft] = useState({
    nome: "",
    unidade_medida: "monetario",
    coluna_planilha: "",
  });

  const canAccess = userRole === "Admin" || userRole === "Financeiro";

  const { data: perfil } = useQuery({
    queryKey: ["perfil_usuario_regras_operacionais", user?.id],
    queryFn: () => (user?.id ? PerfilUsuarioService.getByUserId(user.id) : Promise.resolve(null)),
    enabled: !!user?.id,
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas_regras_operacionais"],
    queryFn: () => EmpresaService.getAll(),
    enabled: canAccess,
  });

  useEffect(() => {
    if (applyGlobally) return;
    if (form.empresa_id) return;
    if (perfil?.empresa_id) {
      setForm((prev) => ({ ...prev, empresa_id: perfil.empresa_id }));
      return;
    }
    if ((empresas as any[]).length > 0) {
      setForm((prev) => ({ ...prev, empresa_id: (empresas as any[])[0].id }));
    }
  }, [applyGlobally, empresas, form.empresa_id, perfil]);

  const { data: tiposServico = [] } = useQuery({
    queryKey: ["tipos_servico_operacional_regras"],
    queryFn: () => TipoServicoOperacionalService.getAllActive(),
    enabled: canAccess,
  });

  const { data: transportadoras = [] } = useQuery({
    queryKey: ["transportadoras_regras_operacionais", form.empresa_id],
    queryFn: () => TransportadoraClienteService.getByEmpresa(form.empresa_id),
    enabled: canAccess && !!form.empresa_id,
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores_regras_operacionais", form.empresa_id],
    queryFn: () => FornecedorService.getByEmpresa(form.empresa_id),
    enabled: canAccess && !!form.empresa_id,
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos_regras_operacionais", form.fornecedor_id],
    queryFn: () => ProdutoCargaService.getByFornecedor(form.fornecedor_id),
    enabled: canAccess && !!form.fornecedor_id,
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["formas_pagamento_regras_operacionais"],
    queryFn: () => FormaPagamentoOperacionalService.getAllActive(),
    enabled: canAccess,
  });

  const { data: tiposRegra = [] } = useQuery({
    queryKey: ["tipos_regra_operacional_regras"],
    queryFn: () => TipoRegraOperacionalService.getAllActive(),
    enabled: canAccess,
  });

  const { data: regras = [], isLoading: isLoadingRegras } = useQuery({
    queryKey: ["regras_operacionais", form.empresa_id || "all"],
    queryFn: () => RegraOperacionalService.getAll(form.empresa_id || undefined),
    enabled: canAccess,
  });

  const filteredRules = useMemo(() => {
    const term = search.trim().toLowerCase();
    const dedupedRules = (regras as any[]).filter((item, index, allItems) => {
      const tr = (tiposRegra as any[]).find((tipo) => tipo.id === item.tipo_regra_id);
      if (!isIssRuleDefinition(tr)) return true;

      const key = buildRuleDedupKey({
        ...item,
        empresa_id: null,
        tipo_servico_id: null,
        fornecedor_id: null,
        transportadora_id: null,
        produto_carga_id: null,
      });

      return index === allItems.findIndex((candidate) => {
        const candidateTr = (tiposRegra as any[]).find((tipo) => tipo.id === candidate.tipo_regra_id);
        if (!isIssRuleDefinition(candidateTr)) return false;

        return buildRuleDedupKey({
          ...candidate,
          empresa_id: null,
          tipo_servico_id: null,
          fornecedor_id: null,
          transportadora_id: null,
          produto_carga_id: null,
        }) === key;
      });
    });

    if (!term) return dedupedRules;

    return dedupedRules.filter((item) =>
      [
        item.empresas?.nome,
        item.tipos_servico_operacional?.nome,
        item.transportadoras_clientes?.nome,
        item.fornecedores?.nome,
        item.produtos_carga?.nome,
        item.tipos_regra_operacional?.nome,
        getTipoCalculoLabel(item.tipo_calculo),
        item.formas_pagamento_operacional?.nome,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [regras, search, tiposRegra]);

  const tipoServicoItems = (tiposServico as any[]).map((item) => ({ ...item, nome: item.nome })) as LookupItem[];
  const transportadoraItems = (transportadoras as any[]).map((item) => ({ ...item, nome: item.nome })) as LookupItem[];
  const fornecedorItems = (fornecedores as any[]).map((item) => ({ ...item, nome: item.nome })) as LookupItem[];
  const produtoItems = (produtos as any[]).map((item) => ({ ...item, nome: item.nome })) as LookupItem[];
  const formaPagamentoItems = (formasPagamento as any[]).map((item) => ({ ...item, nome: item.nome })) as LookupItem[];
  const tipoRegraSelecionado = useMemo(
    () => (tiposRegra as any[]).find((item) => item.id === form.tipo_regra_id) ?? null,
    [form.tipo_regra_id, tiposRegra],
  );
  const issRuleSelected = useMemo(
    () => isIssRuleDefinition(tipoRegraSelecionado),
    [tipoRegraSelecionado],
  );

  const similarTiposServico = useMemo(
    () => getSimilarItems(tipoServicoItems, tipoServicoDraft.nome),
    [tipoServicoDraft.nome, tipoServicoItems],
  );
  const similarTransportadoras = useMemo(
    () => getSimilarItems(transportadoraItems, transportadoraDraft.nome),
    [transportadoraDraft.nome, transportadoraItems],
  );
  const similarFornecedores = useMemo(
    () => getSimilarItems(fornecedorItems, fornecedorDraft.nome),
    [fornecedorDraft.nome, fornecedorItems],
  );
  const similarProdutos = useMemo(
    () => getSimilarItems(produtoItems, produtoDraft.nome),
    [produtoDraft.nome, produtoItems],
  );
  const similarFormasPagamento = useMemo(
    () => getSimilarItems(formaPagamentoItems, formaPagamentoDraft.nome),
    [formaPagamentoDraft.nome, formaPagamentoItems],
  );

  const resetForm = () => {
    setEditingId(null);
    setApplyGlobally(false);
    setForm((prev) => ({
      ...EMPTY_FORM,
      empresa_id: perfil?.empresa_id ?? prev.empresa_id,
    }));
    setCurrentStep(1);
    setIsModalOpen(false);
  };

  useEffect(() => {
    if (!issRuleSelected || !!editingId) return;

    setApplyGlobally(true);
    setForm((prev) => ({
      ...prev,
      empresa_id: "",
      tipo_servico_id: "",
      transportadora_id: "",
      fornecedor_id: "",
      produto_carga_id: "",
    }));
  }, [editingId, issRuleSelected]);

  const openQuickCreate = (type: QuickCreateType, suggestedName = "") => {
    setQuickCreate({ type, suggestedName });

    if (type === "tipo_servico") {
      setTipoServicoDraft({
        nome: suggestedName,
        descricao: "",
      });
    }

    if (type === "transportadora") {
      setTransportadoraDraft({
        nome: suggestedName,
        tipo_cadastro: "transportadora",
        documento: "",
      });
    }

    if (type === "fornecedor") {
      setFornecedorDraft({
        nome: suggestedName,
        documento: "",
      });
    }

    if (type === "produto") {
      setProdutoDraft({
        nome: suggestedName,
        categoria: "",
      });
    }

    if (type === "forma_pagamento") {
      setFormaPagamentoDraft({
        nome: suggestedName,
      });
    }
  };

  const closeQuickCreate = () => setQuickCreate(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const shouldApplyGlobally = applyGlobally || issRuleSelected;
      if (!shouldApplyGlobally && (!form.empresa_id || !form.tipo_servico_id || !form.fornecedor_id)) {
        throw new Error("Selecione empresa, tipo de serviço e fornecedor.");
      }

      if (!form.tipo_calculo || !form.valor_unitario || !form.vigencia_inicio) {
        throw new Error("Preencha tipo de cálculo, valor unitário e vigência inicial.");
      }

      if (form.vigencia_fim && form.vigencia_fim < form.vigencia_inicio) {
        throw new Error("A vigência final não pode ser menor que a vigência inicial.");
      }

      if (issRuleSelected && !editingId) {
        const hasConflict =
          form.status === "ativo"
            ? await RegraOperacionalService.hasActiveConflict({
              empresaId: null,
              tipoServicoId: null,
              fornecedorId: null,
              transportadoraId: null,
              produtoCargaId: null,
              tipoRegraId: form.tipo_regra_id,
              tipoCalculo: form.tipo_calculo,
              vigenciaInicio: form.vigencia_inicio,
              vigenciaFim: normalizeOptionalId(form.vigencia_fim),
            })
            : false;

        if (hasConflict) {
          throw new Error("Ja existe uma regra global de ISS ativa dentro da vigencia informada.");
        }

        return RegraOperacionalService.create({
          empresa_id: null,
          unidade_id: null,
          tipo_servico_id: null,
          fornecedor_id: null,
          transportadora_id: null,
          produto_carga_id: null,
          tipo_regra_id: form.tipo_regra_id,
          tipo_calculo: form.tipo_calculo,
          valor_unitario: Number(form.valor_unitario.replace(",", ".")),
          forma_pagamento_id: normalizeOptionalId(form.forma_pagamento_id),
          vigencia_inicio: form.vigencia_inicio,
          vigencia_fim: normalizeOptionalId(form.vigencia_fim),
          ativo: form.status === "ativo",
        });
      }

      if (applyGlobally && !editingId) {
        const basePayload = {
          unidade_id: null,
          transportadora_id: null,
          produto_carga_id: null,
          tipo_regra_id: form.tipo_regra_id,
          tipo_calculo: form.tipo_calculo,
          valor_unitario: Number(form.valor_unitario.replace(",", ".")),
          forma_pagamento_id: normalizeOptionalId(form.forma_pagamento_id),
          vigencia_inicio: form.vigencia_inicio,
          vigencia_fim: normalizeOptionalId(form.vigencia_fim),
          ativo: form.status === "ativo",
        };

        const [allTiposServico, allFornecedores] = await Promise.all([
          TipoServicoOperacionalService.getAllActive(),
          FornecedorService.getByEmpresa(),
        ]);

        if (allTiposServico.length === 0) {
          throw new Error("NÃ£o existem tipos de serviÃ§o ativos para aplicaÃ§Ã£o global.");
        }

        if (allFornecedores.length === 0) {
          throw new Error("NÃ£o existem fornecedores ativos para aplicaÃ§Ã£o global.");
        }

        const payloads = allFornecedores.flatMap((fornecedor: any) =>
          allTiposServico.map((tipoServico: any) => ({
            ...basePayload,
            empresa_id: fornecedor.empresa_id,
            fornecedor_id: fornecedor.id,
            tipo_servico_id: tipoServico.id,
          })),
        );

        const availablePayloads: Record<string, any>[] = [];
        let skippedConflicts = 0;

        for (const payload of payloads) {
          const hasConflict =
            payload.ativo
              ? await RegraOperacionalService.hasActiveConflict({
                empresaId: payload.empresa_id,
                tipoServicoId: payload.tipo_servico_id,
                fornecedorId: payload.fornecedor_id,
                transportadoraId: null,
                produtoCargaId: null,
                tipoRegraId: payload.tipo_regra_id,
                tipoCalculo: payload.tipo_calculo,
                vigenciaInicio: payload.vigencia_inicio,
                vigenciaFim: payload.vigencia_fim,
              })
              : false;

          if (hasConflict) {
            skippedConflicts += 1;
            continue;
          }

          availablePayloads.push(payload);
        }

        if (availablePayloads.length === 0) {
          throw new Error("Todas as combinaÃ§Ãµes globais jÃ¡ possuem regra ativa nessa vigÃªncia.");
        }

        const created = await RegraOperacionalService.createMany(availablePayloads);
        return {
          createdCount: created.length,
          skippedConflicts,
        };
      }

      const hasConflict =
        form.status === "ativo"
          ? await RegraOperacionalService.hasActiveConflict({
            empresaId: issRuleSelected ? null : normalizeOptionalId(form.empresa_id),
            tipoServicoId: issRuleSelected ? null : normalizeOptionalId(form.tipo_servico_id),
            fornecedorId: issRuleSelected ? null : normalizeOptionalId(form.fornecedor_id),
            transportadoraId: issRuleSelected ? null : normalizeOptionalId(form.transportadora_id),
            produtoCargaId: issRuleSelected ? null : normalizeOptionalId(form.produto_carga_id),
            tipoRegraId: form.tipo_regra_id,
            tipoCalculo: form.tipo_calculo,
            vigenciaInicio: form.vigencia_inicio,
            vigenciaFim: normalizeOptionalId(form.vigencia_fim),
            excludeId: editingId ?? undefined,
          })
          : false;

      if (hasConflict) {
        throw new Error("Já existe uma regra ativa para essa combinação dentro da vigência informada.");
      }

      const payload = {
        empresa_id: issRuleSelected ? null : normalizeOptionalId(form.empresa_id),
        unidade_id: null,
        tipo_servico_id: issRuleSelected ? null : normalizeOptionalId(form.tipo_servico_id),
        fornecedor_id: issRuleSelected ? null : normalizeOptionalId(form.fornecedor_id),
        transportadora_id: issRuleSelected ? null : normalizeOptionalId(form.transportadora_id),
        produto_carga_id: issRuleSelected ? null : normalizeOptionalId(form.produto_carga_id),
        tipo_regra_id: form.tipo_regra_id,
        tipo_calculo: form.tipo_calculo,
        valor_unitario: Number(form.valor_unitario.replace(",", ".")),
        forma_pagamento_id: normalizeOptionalId(form.forma_pagamento_id),
        vigencia_inicio: form.vigencia_inicio,
        vigencia_fim: normalizeOptionalId(form.vigencia_fim),
        ativo: form.status === "ativo",
      };

      return editingId
        ? RegraOperacionalService.update(editingId, payload)
        : RegraOperacionalService.create(payload);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["regras_operacionais"] });
      if (editingId) {
        toast.success("Regra operacional atualizada.");
      } else if (applyGlobally) {
        const createdCount = result?.createdCount ?? 0;
        const skippedConflicts = result?.skippedConflicts ?? 0;
        toast.success("Regras operacionais geradas em lote.", {
          description:
            skippedConflicts > 0
              ? `${createdCount} regra(s) criadas e ${skippedConflicts} combinaÃ§Ã£o(Ãµes) jÃ¡ existentes foram ignoradas.`
              : `${createdCount} regra(s) criadas com aplicaÃ§Ã£o global.`,
        });
      } else if (issRuleSelected) {
        toast.success("Regra global de ISS cadastrada.");
      } else {
        toast.success("Regra operacional cadastrada.");
      }
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Não foi possível salvar a regra.", {
        description: error.message,
      });
    },
  });

  const quickCreateMutation = useMutation({
    mutationFn: async () => {
      if (!quickCreate) throw new Error("Cadastro rápido indisponível.");

      if (quickCreate.type === "transportadora") {
        if (!form.empresa_id) throw new Error("Selecione a empresa antes de cadastrar a transportadora.");
        if (!transportadoraDraft.nome.trim()) throw new Error("Informe o nome da transportadora ou cliente.");

        const duplicate = transportadoraItems.find(
          (item) => normalizeText(item.nome) === normalizeText(transportadoraDraft.nome),
        );
        if (duplicate) {
          throw new Error("Já existe uma transportadora ou cliente com nome equivalente para esta empresa.");
        }

        return {
          type: quickCreate.type,
          data: await TransportadoraClienteService.create({
            empresa_id: form.empresa_id,
            nome: transportadoraDraft.nome.trim(),
            tipo_cadastro: transportadoraDraft.tipo_cadastro,
            documento: transportadoraDraft.documento.trim() || null,
            ativo: true,
          }),
        };
      }

      if (quickCreate.type === "tipo_servico") {
        if (!tipoServicoDraft.nome.trim()) throw new Error("Informe o nome do tipo de serviço.");

        const duplicate = tipoServicoItems.find(
          (item) => normalizeText(item.nome) === normalizeText(tipoServicoDraft.nome),
        );
        if (duplicate) {
          throw new Error("Já existe um tipo de serviço com nome equivalente.");
        }

        return {
          type: quickCreate.type,
          data: await TipoServicoOperacionalService.create({
            nome: tipoServicoDraft.nome.trim(),
            descricao: tipoServicoDraft.descricao.trim() || null,
            ativo: true,
          }),
        };
      }

      if (quickCreate.type === "fornecedor") {
        if (!form.empresa_id) throw new Error("Selecione a empresa antes de cadastrar o fornecedor.");
        if (!fornecedorDraft.nome.trim()) throw new Error("Informe o nome do fornecedor.");

        const duplicate = fornecedorItems.find(
          (item) => normalizeText(item.nome) === normalizeText(fornecedorDraft.nome),
        );
        if (duplicate) {
          throw new Error("Já existe um fornecedor com nome equivalente para esta empresa.");
        }

        return {
          type: quickCreate.type,
          data: await FornecedorService.create({
            empresa_id: form.empresa_id,
            nome: fornecedorDraft.nome.trim(),
            documento: fornecedorDraft.documento.trim() || null,
            ativo: true,
          }),
        };
      }

      if (quickCreate.type === "produto") {
        if (!form.fornecedor_id) throw new Error("Selecione o fornecedor antes de cadastrar o produto ou carga.");
        if (!produtoDraft.nome.trim()) throw new Error("Informe o nome do produto ou carga.");

        const duplicate = produtoItems.find(
          (item) => normalizeText(item.nome) === normalizeText(produtoDraft.nome),
        );
        if (duplicate) {
          throw new Error("Já existe um produto ou carga equivalente para este fornecedor.");
        }

        return {
          type: quickCreate.type,
          data: await ProdutoCargaService.create({
            fornecedor_id: form.fornecedor_id,
            nome: produtoDraft.nome.trim(),
            categoria: produtoDraft.categoria.trim() || null,
            descricao: produtoDraft.categoria.trim() ? `Categoria: ${produtoDraft.categoria.trim()}` : null,
            ativo: true,
          }),
        };
      }

      if (quickCreate.type === "tipo_regra") {
        if (!tipoRegraDraft.nome.trim()) {
          throw new Error("Informe o nome do tipo de regra.");
        }

        const duplicate = (tiposRegra as any[]).find(
          (item) => normalizeText(item.nome) === normalizeText(tipoRegraDraft.nome),
        );
        if (duplicate) {
          throw new Error("Já existe um tipo de regra com nome equivalente.");
        }

        return {
          type: quickCreate.type,
          data: await TipoRegraOperacionalService.create({
            nome: tipoRegraDraft.nome.trim(),
            unidade_medida: tipoRegraDraft.unidade_medida,
            coluna_planilha: tipoRegraDraft.coluna_planilha.trim() || null,
            ativo: true,
          }),
        };
      }

      if (!formaPagamentoDraft.nome.trim()) {
        throw new Error("Informe o nome da forma de pagamento.");
      }

      const duplicate = formaPagamentoItems.find(
        (item) => normalizeText(item.nome) === normalizeText(formaPagamentoDraft.nome),
      );
      if (duplicate) {
        throw new Error("Já existe uma forma de pagamento com nome equivalente.");
      }

      return {
        type: quickCreate.type,
        data: await FormaPagamentoOperacionalService.create({
          nome: formaPagamentoDraft.nome.trim(),
          ativo: true,
        }),
      };
    },
    onSuccess: async (result: any) => {
      if (result.type === "tipo_servico") {
        await queryClient.invalidateQueries({ queryKey: ["tipos_servico_operacional_regras"] });
        setForm((prev) => ({ ...prev, tipo_servico_id: result.data.id }));
      }

      if (result.type === "transportadora") {
        await queryClient.invalidateQueries({ queryKey: ["transportadoras_regras_operacionais"] });
        setForm((prev) => ({ ...prev, transportadora_id: result.data.id }));
      }

      if (result.type === "fornecedor") {
        await queryClient.invalidateQueries({ queryKey: ["fornecedores_regras_operacionais"] });
        setForm((prev) => ({
          ...prev,
          fornecedor_id: result.data.id,
          produto_carga_id: "",
        }));
      }

      if (result.type === "produto") {
        await queryClient.invalidateQueries({ queryKey: ["produtos_regras_operacionais"] });
        setForm((prev) => ({ ...prev, produto_carga_id: result.data.id }));
      }

      if (result.type === "forma_pagamento") {
        await queryClient.invalidateQueries({ queryKey: ["formas_pagamento_regras_operacionais"] });
        setForm((prev) => ({ ...prev, forma_pagamento_id: result.data.id }));
      }

      if (result.type === "tipo_regra") {
        await queryClient.invalidateQueries({ queryKey: ["tipos_regra_operacional_regras"] });
        setForm((prev) => ({ ...prev, tipo_regra_id: result.data.id }));
      }

      toast.success("Cadastro rápido concluído.");
      closeQuickCreate();
    },
    onError: (error: any) => {
      toast.error("Não foi possível concluir o cadastro rápido.", {
        description: error.message,
      });
    },
  });

  const inactivateMutation = useMutation({
    mutationFn: (id: string) => RegraOperacionalService.inativar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras_operacionais"] });
      toast.success("Regra operacional inativada.");
      if (editingId) resetForm();
    },
    onError: (error: any) => {
      toast.error("Não foi possível inativar a regra.", {
        description: error.message,
      });
    },
  });

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setApplyGlobally(false);
    setForm({
      empresa_id: item.empresa_id ?? "",
      tipo_servico_id: item.tipo_servico_id ?? "",
      transportadora_id: item.transportadora_id ?? "",
      fornecedor_id: item.fornecedor_id ?? "",
      produto_carga_id: item.produto_carga_id ?? "",
      tipo_regra_id: item.tipo_regra_id ?? "",
      tipo_calculo: item.tipo_calculo ?? "",
      valor_unitario: item.valor_unitario != null ? String(item.valor_unitario) : "",
      forma_pagamento_id: item.forma_pagamento_id ?? "",
      vigencia_inicio: item.vigencia_inicio ?? "",
      vigencia_fim: item.vigencia_fim ?? "",
      status: item.ativo ? "ativo" : "inativo",
    });
    setCurrentStep(1);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!form.fornecedor_id && form.produto_carga_id) {
      setForm((prev) => ({ ...prev, produto_carga_id: "" }));
    }
  }, [form.fornecedor_id, form.produto_carga_id]);

  const similarItemsForDialog =
    quickCreate?.type === "tipo_servico"
      ? similarTiposServico
      : quickCreate?.type === "transportadora"
        ? similarTransportadoras
        : quickCreate?.type === "fornecedor"
          ? similarFornecedores
          : quickCreate?.type === "produto"
            ? similarProdutos
            : similarFormasPagamento;

  const useExistingItem = (item: LookupItem) => {
    if (quickCreate?.type === "tipo_servico") {
      setForm((prev) => ({ ...prev, tipo_servico_id: item.id }));
    }

    if (quickCreate?.type === "transportadora") {
      setForm((prev) => ({ ...prev, transportadora_id: item.id }));
    }

    if (quickCreate?.type === "fornecedor") {
      setForm((prev) => ({ ...prev, fornecedor_id: item.id, produto_carga_id: "" }));
    }

    if (quickCreate?.type === "produto") {
      setForm((prev) => ({ ...prev, produto_carga_id: item.id }));
    }

    if (quickCreate?.type === "forma_pagamento") {
      setForm((prev) => ({ ...prev, forma_pagamento_id: item.id }));
    }

    closeQuickCreate();
    toast.success("Item existente selecionado.");
  };

  if (isLoadingRole) {
    return (
      <AppShell title="Regras Operacionais" subtitle="Carregando permissões..." backPath="/cadastros">
        <div />
      </AppShell>
    );
  }

  if (!canAccess) {
    return (
      <AppShell title="Regras Operacionais" subtitle="Acesso restrito a Admin e Financeiro" backPath="/cadastros">
        <Card className="p-8 border-dashed">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="space-y-2">
              <h2 className="font-semibold text-foreground">Sem permissão para este cadastro</h2>
              <p className="text-sm text-muted-foreground">
                Esta tela está disponível apenas para os perfis <strong>Admin</strong> e <strong>Financeiro</strong>.
              </p>
            </div>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Regras Operacionais"
      subtitle="Cadastre o valor unitário que será aplicado automaticamente na produção"
      backPath="/cadastros"
    >
      <div className="space-y-6">
        <Card className="p-5 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Regras cadastradas</h2>
              <p className="text-sm text-muted-foreground">
                Edite valores ou inative regras para impedir novos lançamentos com essa configuração.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por empresa, serviço..."
                className="md:max-w-sm"
              />
              <Button onClick={() => { setIsModalOpen(true); setCurrentStep(1); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Regra
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo de serviço</TableHead>
                  <TableHead>Transportadora</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Produto / Carga</TableHead>
                  <TableHead>Tipo de cálculo</TableHead>
                  <TableHead>Valor / Tipo de Regra</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isLoadingRegras && filteredRules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                      Nenhuma regra operacional encontrada.
                    </TableCell>
                  </TableRow>
                )}

                {filteredRules.map((item: any) => {
                  const tr = (tiposRegra as any[]).find((t) => t.id === item.tipo_regra_id);
                  const isPct = tr?.unidade_medida === "percentual";
                  const isGlobalIssRule = isIssRuleDefinition(tr);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{isGlobalIssRule ? "Global" : item.empresas?.nome ?? "-"}</TableCell>
                      <TableCell>{isGlobalIssRule ? "Todos" : item.tipos_servico_operacional?.nome ?? "-"}</TableCell>
                      <TableCell>{isGlobalIssRule ? "Todas" : item.transportadoras_clientes?.nome ?? "Todas"}</TableCell>
                      <TableCell>{isGlobalIssRule ? "Todos" : item.fornecedores?.nome ?? "-"}</TableCell>
                      <TableCell>{item.produtos_carga?.nome ?? "Geral"}</TableCell>
                      <TableCell>{getTipoCalculoLabel(item.tipo_calculo)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">
                            {isPct ? `${Number(item.valor_unitario)}%` : formatCurrency(Number(item.valor_unitario || 0))}
                          </span>
                          <Badge variant="outline" className="w-fit text-[10px] h-4">
                            {tr?.nome ?? "Taxa Operacional"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDate(item.vigencia_inicio)}
                        <span className="text-muted-foreground"> até {formatDate(item.vigencia_fim)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(item.ativo ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-zinc-200 text-zinc-700 hover:bg-zinc-200")}>
                          {item.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => handleEdit(item)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!item.ativo || inactivateMutation.isPending}
                            onClick={() => inactivateMutation.mutate(item.id)}
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            Inativar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Dialog open={!!quickCreate} onOpenChange={(open) => !open && closeQuickCreate()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {quickCreate?.type === "transportadora" && "Cadastro rápido de transportadora / cliente"}
              {quickCreate?.type === "fornecedor" && "Cadastro rápido de fornecedor"}
              {quickCreate?.type === "produto" && "Cadastro rápido de produto / carga"}
              {quickCreate?.type === "forma_pagamento" && "Cadastro rápido de forma de pagamento"}
              {quickCreate?.type === "tipo_regra" && "Cadastro rápido de tipo de regra"}
            </DialogTitle>
            <DialogDescription>
              O item salvo entra na base operacional, fica disponível nesta tela e também passa a aparecer em `/producao`.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {quickCreate?.type === "transportadora" && (
              <>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={transportadoraDraft.nome}
                    onChange={(event) => setTransportadoraDraft((prev) => ({ ...prev, nome: event.target.value }))}
                    placeholder="Ex.: Mira"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={transportadoraDraft.tipo_cadastro}
                    onValueChange={(value) => setTransportadoraDraft((prev) => ({ ...prev, tipo_cadastro: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transportadora">Transportadora</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="transportadora_cliente">Transportadora e cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input
                    value={transportadoraDraft.documento}
                    onChange={(event) => setTransportadoraDraft((prev) => ({ ...prev, documento: event.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
              </>
            )}

            {quickCreate?.type === "tipo_servico" && (
              <>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={tipoServicoDraft.nome}
                    onChange={(event) => setTipoServicoDraft((prev) => ({ ...prev, nome: event.target.value }))}
                    placeholder="Ex.: Descarga"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={tipoServicoDraft.descricao}
                    onChange={(event) => setTipoServicoDraft((prev) => ({ ...prev, descricao: event.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
              </>
            )}

            {quickCreate?.type === "fornecedor" && (
              <>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={fornecedorDraft.nome}
                    onChange={(event) => setFornecedorDraft((prev) => ({ ...prev, nome: event.target.value }))}
                    placeholder="Ex.: Ponteland"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input
                    value={fornecedorDraft.documento}
                    onChange={(event) => setFornecedorDraft((prev) => ({ ...prev, documento: event.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
              </>
            )}

            {quickCreate?.type === "produto" && (
              <>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={produtoDraft.nome}
                    onChange={(event) => setProdutoDraft((prev) => ({ ...prev, nome: event.target.value }))}
                    placeholder="Ex.: Geral"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Input
                    value={produtoDraft.categoria}
                    onChange={(event) => setProdutoDraft((prev) => ({ ...prev, categoria: event.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
              </>
            )}

            {quickCreate?.type === "forma_pagamento" && (
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formaPagamentoDraft.nome}
                  onChange={(event) => setFormaPagamentoDraft({ nome: event.target.value })}
                  placeholder="Ex.: Quinzena"
                />
              </div>
            )}

            {quickCreate?.type === "tipo_regra" && (
              <>
                <div className="space-y-2">
                  <Label>Nome da Regra / Variável</Label>
                  <Input
                    value={tipoRegraDraft.nome}
                    onChange={(event) => setTipoRegraDraft((prev) => ({ ...prev, nome: event.target.value }))}
                    placeholder="Ex.: ISS, Adicional Noturno, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Valor</Label>
                  <Select
                    value={tipoRegraDraft.unidade_medida}
                    onValueChange={(value) => setTipoRegraDraft((prev) => ({ ...prev, unidade_medida: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monetario">Monetário (R$)</SelectItem>
                      <SelectItem value="percentual">Percentual (%)</SelectItem>
                      <SelectItem value="quantidade">Quantidade (un)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vincular a Coluna da Planilha</Label>
                  <Input
                    value={tipoRegraDraft.coluna_planilha}
                    onChange={(event) => setTipoRegraDraft((prev) => ({ ...prev, coluna_planilha: event.target.value }))}
                    placeholder="Ex.: % ISS (Nome exato da coluna)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Ao realizar importação, o sistema tentará associar automaticamente a esta coluna.
                  </p>
                </div>
              </>
            )}

            {similarItemsForDialog.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="flex items-start gap-2 text-amber-900">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Já existe um cadastro parecido. Deseja usar o item existente?</p>
                    <p className="text-xs text-amber-800">
                      Nomes equivalentes ou muito próximos são sinalizados para evitar duplicidade simples.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {similarItemsForDialog.map((item) => (
                    <Button key={item.id} type="button" variant="outline" size="sm" onClick={() => useExistingItem(item)}>
                      Usar {item.nome}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeQuickCreate}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => quickCreateMutation.mutate()} disabled={quickCreateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Salvar cadastro rápido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar regra operacional" : "Nova regra operacional"}</DialogTitle>
            <DialogDescription>
              Preencha as informações guiadas para configurar o cálculo aplicado na produção.
            </DialogDescription>
          </DialogHeader>

          {/* Stepper Wizard */}
          <div className="flex items-center justify-between mb-2 mt-4 relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-border -z-10" />
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex flex-col items-center gap-1 bg-background px-2">
                <div className={cn("flex items-center justify-center h-8 w-8 rounded-full border-2 text-sm font-semibold transition-colors duration-200",
                  currentStep === step ? "border-primary bg-primary text-primary-foreground" :
                    currentStep > step ? "border-primary bg-primary/10 text-primary" : "border-muted-foreground/30 text-muted-foreground/50 bg-background")}>
                  {currentStep > step ? <Check className="h-4 w-4" /> : step}
                </div>
                <span className={cn("text-xs font-medium", currentStep === step ? "text-foreground" : "text-muted-foreground/70")}>
                  {step === 1 ? "Identificação" : step === 2 ? "Parâmetros" : "Validade"}
                </span>
              </div>
            ))}
          </div>

          <div className="py-2 min-h-[300px]">
            {currentStep === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="border-b pb-2 mb-4">
                  <h3 className="text-sm font-medium tracking-tight text-foreground/80">
                    1. Identificação Operacional
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Defina a quem e a quais serviços essa regra se aplica.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="apply-global"
                        checked={applyGlobally || issRuleSelected}
                        disabled={!!editingId || issRuleSelected}
                        onCheckedChange={(checked) => {
                          if (issRuleSelected) return;
                          const enabled = checked === true;
                          setApplyGlobally(enabled);

                          if (enabled) {
                            setForm((prev) => ({
                              ...prev,
                              empresa_id: "",
                              tipo_servico_id: "",
                              transportadora_id: "",
                              fornecedor_id: "",
                              produto_carga_id: "",
                            }));
                            return;
                          }

                          setForm((prev) => ({
                            ...prev,
                            empresa_id: perfil?.empresa_id ?? (empresas as any[])[0]?.id ?? "",
                          }));
                        }}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="apply-global" className="cursor-pointer text-sm font-medium">
                          Aplicar globalmente
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {issRuleSelected
                            ? "Regras da coluna ISS sao sempre globais. O mesmo valor podera ser aplicado em todas as linhas da coluna, sem depender de fornecedor, fabricante ou TC."
                            : "Gera automaticamente a regra para todas as empresas, todos os fornecedores e todos os tipos de serviÃ§o. Transportadora e produto ficam como regra geral."}
                        </p>
                        {!!editingId && !issRuleSelected && (
                          <p className="text-xs text-muted-foreground">
                            A aplicaÃ§Ã£o global fica disponÃ­vel apenas para novas regras.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Empresa / Unidade</Label>
                    <Select
                      value={form.empresa_id}
                      disabled={applyGlobally}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          empresa_id: value,
                          transportadora_id: "",
                          fornecedor_id: "",
                          produto_carga_id: "",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {(empresas as any[]).map((empresa) => (
                          <SelectItem key={empresa.id} value={empresa.id}>
                            {empresa.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <QuickCreateLookup
                    label="Tipo de serviço"
                    placeholder="Selecione o tipo de serviço"
                    value={form.tipo_servico_id}
                    items={tipoServicoItems}
                    disabled={applyGlobally}
                    createLabel="Novo tipo"
                    onChange={(value) => setForm((prev) => ({ ...prev, tipo_servico_id: value }))}
                    onCreate={(searchTerm) => openQuickCreate("tipo_servico", searchTerm)}
                  />

                  <QuickCreateLookup
                    label="Transportadora / Cliente"
                    placeholder="Selecione, se aplicável"
                    value={form.transportadora_id}
                    items={transportadoraItems}
                    disabled={applyGlobally || !form.empresa_id}
                    emptyOptionLabel="Todos"
                    createLabel="Nova transportadora"
                    onChange={(value) => setForm((prev) => ({ ...prev, transportadora_id: value }))}
                    onCreate={(searchTerm) => openQuickCreate("transportadora", searchTerm)}
                  />

                  <QuickCreateLookup
                    label="Fornecedor"
                    placeholder={applyGlobally ? "Todos os fornecedores" : "Selecione o fornecedor"}
                    value={form.fornecedor_id}
                    items={fornecedorItems}
                    disabled={applyGlobally || !form.empresa_id}
                    createLabel="Novo fornecedor"
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        fornecedor_id: value,
                        produto_carga_id: "",
                      }))
                    }
                    onCreate={(searchTerm) => openQuickCreate("fornecedor", searchTerm)}
                  />

                  <QuickCreateLookup
                    label="Produto / Carga"
                    placeholder={!form.fornecedor_id ? "Selecione o fornecedor antes" : "Selecione, se aplicável"}
                    value={form.produto_carga_id}
                    items={produtoItems}
                    disabled={applyGlobally || !form.fornecedor_id}
                    emptyOptionLabel="Geral"
                    createLabel="Novo produto"
                    onChange={(value) => setForm((prev) => ({ ...prev, produto_carga_id: value }))}
                    onCreate={(searchTerm) => openQuickCreate("produto", searchTerm)}
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="border-b pb-2 mb-4">
                  <h3 className="text-sm font-medium tracking-tight text-foreground/80">
                    2. Parâmetros da Regra
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure como o cálculo será realizado e o valor aplicado.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo de cálculo</Label>
                    <Select value={form.tipo_calculo} onValueChange={(value) => setForm((prev) => ({ ...prev, tipo_calculo: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cálculo" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_CALCULO.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <QuickCreateLookup
                    label="Tipo de Regra / Variável"
                    placeholder="Selecione o tipo de regra"
                    value={form.tipo_regra_id}
                    items={(tiposRegra as any[]).map(t => ({ id: t.id, nome: t.nome }))}
                    createLabel="Nova regra"
                    onChange={(value) => setForm((prev) => ({ ...prev, tipo_regra_id: value }))}
                    onCreate={(searchTerm) => openQuickCreate("tipo_regra", searchTerm)}
                  />

                  <div className="space-y-2">
                    <Label>Valor / Quantidade / Percentual</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={form.valor_unitario}
                      onChange={(event) => setForm((prev) => ({ ...prev, valor_unitario: event.target.value }))}
                      placeholder="Ex: 5 ou 0,3500"
                    />
                  </div>

                  <QuickCreateLookup
                    label="Forma de pagamento padrão"
                    placeholder="Opcional"
                    value={form.forma_pagamento_id}
                    items={formaPagamentoItems}
                    emptyOptionLabel="Não definir"
                    createLabel="Nova forma"
                    onChange={(value) => setForm((prev) => ({ ...prev, forma_pagamento_id: value }))}
                    onCreate={(searchTerm) => openQuickCreate("forma_pagamento", searchTerm)}
                  />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="border-b pb-2 mb-4">
                  <h3 className="text-sm font-medium tracking-tight text-foreground/80">
                    3. Validade e Situação
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Controle a partir de quando esta regra é válida.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Vigência inicial</Label>
                    <Input type="date" value={form.vigencia_inicio} onChange={(event) => setForm((prev) => ({ ...prev, vigencia_inicio: event.target.value }))} />
                  </div>

                  <div className="space-y-2">
                    <Label>Vigência final</Label>
                    <Input type="date" value={form.vigencia_fim} onChange={(event) => setForm((prev) => ({ ...prev, vigencia_fim: event.target.value }))} />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(value: "ativo" | "inativo") => setForm((prev) => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between sm:justify-between w-full border-t pt-4">
            <Button type="button" variant="outline" onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : setIsModalOpen(false)}>
              {currentStep > 1 ? "Voltar" : "Cancelar"}
            </Button>
            {currentStep < 3 ? (
              <Button type="button" onClick={() => setCurrentStep(currentStep + 1)}>
                Avançar
              </Button>
            ) : (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {editingId ? "Salvar alterações" : "Cadastrar regra"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default RegrasOperacionais;
