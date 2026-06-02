import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productionSchema, type ProductionFormValues } from "../schema";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { 
  FornecedorValorServicoService, 
  RegraOperacionalService, 
  RegrasDadosService 
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

  // Atualiza valor unitário e forma de pagamento automaticamente quando a regra muda
  useEffect(() => {
    if (precoRegra?.regra_encontrada) {
      setValue("valor_unitario", Number(precoRegra.valor_unitario));
      if (precoRegra.forma_pagamento_id) {
        setValue("forma_pagamento", precoRegra.forma_pagamento_id);
      }
    }
  }, [precoRegra, setValue]);

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
  };
}
