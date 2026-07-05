const payload_input = {
    tipo_lancamento: "operacao_padrao",
    data: "2026-07-05",
    quantidade: 800,
    quantidade_colaboradores: 1,
    nf_emite: false,
    status_financeiro: "PENDENTE",
    categoria_servico: "SERVICO_VOLUME",
    nf_numero: "NÃO",
};

const formData = { ...payload_input };

const {
    data,
    quantidade_colaboradores,
    tipo_lancamento,
    tipo_servico,
    transportadora,
    fornecedor,
    produto,
    forma_pagamento,
    valor_unitario,
    iss_percentual,
    valor_iss,
    valor_total_liquido,
    nf_emite,
    valor_unitario_manual,
    descricao_servico,
    categoria_servico,
    justificativa_data,
    placa_veiculo,
    status_financeiro,
    data_vencimento,
    horario_inicio,
    horario_fim,
    regra_periodo_id,
    ...rest
} = formData;

const payload = {
    ...rest,
    data_operacao: data,
    nf_numero: formData.nf_emite ? (rest.nf_numero || "SIM") : "NÃO",
};

console.log("REST:", rest);
console.log("PAYLOAD:", payload);

const {
    categoria_servico: cs,
    categoria_custo,
    tipo_calculo,
    descricao_servico: ds,
    modalidade_financeira,
    produto_label,
    transportadora_label,
    tipo_servico_label,
    quantidade_label,
    horario_inicio_label,
    horario_fim_label,
    valor_unitario_label,
    valor_total_label,
    criado_em_label,
    forma_pagamento_label,
    encarregado_label,
    empresa_label,
    unidade_label,
    tipo_lancamento: tl,
    data: d,
    nf_emite: nf,
    iss_percentual: ip,
    valor_iss: vi,
    valor_total_liquido: vtl,
    justificativa_data: jd,
    placa_veiculo: pv,
    valor_unitario_manual: vum,
    status_financeiro: sf,
    data_vencimento: dv,
    horario_inicio: hi,
    horario_fim: hf,
    ...safePayload
} = payload;

console.log("SAFE PAYLOAD:", safePayload);
