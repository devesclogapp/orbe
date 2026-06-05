import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productionSchema, type ProductionFormValues } from "../schema";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { 
  FornecedorValorServicoService, 
  RegraOperacionalService, 
  RegrasDadosService,
  ServicosEspecificosRegrasService
} from "@/services/base.service";

interface UseProductionFormProps {
  empresaId: string;
  defaultValues?: Partial<ProductionFormValues>;
}

export function useProductionForm({ empresaId, defaultValues }: UseProductionFormProps) {
  const form = useForm<ProductionFormValues>({
    resolver: zodResolver(productionSchema),
    defaultValues: {
      empresa_id: empresaId,
      ...defaultValues,
    },
  });

  const { watch, setValue } = form;
  const values = watch();

  // Lookup de Regra de Valor
  const { data: precoRegra, isFetching: loadingPreco } = useQuery({
    queryKey: ["resolver_preco", values.empresa_id, values.unidade_id, values.tipo_servico, values.fornecedor, values.transportadora, values.produto, values.data],
    queryFn: () => FornecedorValorServicoService.resolverValor({
      empresaId: values.empresa_id,
      unidadeId: values.unidade_id || null,
      tipoServicoId: values.tipo_servico,
      fornecedorId: values.fornecedor || null,
      transportadoraId: values.transportadora || null,
      produtoCargaId: values.produto || null,
      dataOperacao: values.data,
    }),
    enabled: !!values.empresa_id && !!values.data && !!values.tipo_servico,
  });

  // Lookup de ISS
  const { data: regraIss } = useQuery({
    queryKey: ["resolver_iss", values.empresa_id, values.tipo_servico, values.data],
    queryFn: async () => {
      const res = await FornecedorValorServicoService.resolverIss({
        empresaId: values.empresa_id,
        tipoServicoId: values.tipo_servico || null,
        dataOperacao: values.data,
      });
      console.log("[ISS] Resultado do resolverIss:", res);
      return res;
    },
    enabled: !!values.empresa_id && !!values.data && values.nf_emite,
  });
  
  // Regras de Período (D1, N1...)
  const { data: regrasPeriodo = [] } = useQuery({
    queryKey: ["servicos_especificos_regras", values.empresa_id],
    queryFn: () => ServicosEspecificosRegrasService.getAtivosByEmpresa(values.empresa_id),
    enabled: !!values.empresa_id && values.tipo_lancamento === 'servicos_especificos'
  });

  const selectedPeriodo = useMemo(() => {
    return regrasPeriodo.find(r => r.id === values.regra_periodo_id);
  }, [regrasPeriodo, values.regra_periodo_id]);

  // Atualiza valor unitário e forma de pagamento automaticamente quando a regra muda
  useEffect(() => {
    if (precoRegra?.regra_encontrada) {
      console.log("[PRECO] Regra de valor encontrada:", precoRegra);
      setValue("valor_unitario", Number(precoRegra.valor_unitario));
      if (precoRegra.forma_pagamento_id) {
        setValue("forma_pagamento", precoRegra.forma_pagamento_id);
      }
    }
  }, [precoRegra, setValue]);

  // Atualiza campo ISS quando regra de ISS é encontrada ou NF é ligada
  useEffect(() => {
    if (values.nf_emite) {
      if (regraIss?.regra_encontrada) {
        console.log("[ISS] Aplicando percentual da regra:", Number(regraIss.percentual_iss) * 100);
        setValue("iss_percentual", Number(regraIss.percentual_iss) * 100);
      } else if (!values.iss_percentual) {
        // Fallback inicial enquanto carrega ou se não encontrar regra específica
        console.log("[ISS] Fallback para 5% (NF ligada)");
        setValue("iss_percentual", 5);
      }
    } else {
      console.log("[ISS] NF desligada, zerando ISS");
      setValue("iss_percentual", 0);
    }
  }, [regraIss, values.nf_emite, setValue]);

  // Cálculo de total e ISS
  useEffect(() => {
    let bruto = Number(values.quantidade || 0) * Number(values.valor_unitario || 0);
    
    // Aplicar Multiplicador de Turno se for Serviço Específico
    if (values.tipo_lancamento === 'servicos_especificos' && selectedPeriodo) {
      bruto = bruto * Number(selectedPeriodo.peso_multiplicador || 1);
    }

    const taxa = Number(values.iss_percentual || 0);
    const iss = values.nf_emite ? (bruto * (taxa / 100)) : 0;
    
    setValue("valor_iss", iss);
    setValue("valor_total_liquido", bruto - iss);
  }, [values.quantidade, values.valor_unitario, values.iss_percentual, values.nf_emite, values.tipo_lancamento, selectedPeriodo, setValue]);

  // Lookup de Regra Financeira (Modalidade vs Forma)
  const { data: regraFinanceira } = useQuery({
    queryKey: ["regra_financeira", values.modalidade_financeira, values.forma_pagamento],
    queryFn: () => RegrasDadosService.buscarPorModalidadeEForma(values.modalidade_financeira, values.forma_pagamento),
    enabled: !!values.modalidade_financeira && !!values.forma_pagamento,
  });

  return {
    form,
    loadingPreco,
    regraFinanceira,
    precoRegra,
    regraIss,
    regrasPeriodo,
    selectedPeriodo
  };
}
