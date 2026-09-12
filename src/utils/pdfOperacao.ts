import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const generateOperacaoFichaPDF = (op: any) => {
  const doc = new jsPDF("p", "mm", "a4");

  const opId = (op.id || '').substring(0, 8).toUpperCase();
  const clienteNome = op.empresas?.nome || op.empresa_label || 'Cliente Não Identificado';
  const dataOp = op.data_operacao 
    ? format(new Date(op.data_operacao + 'T12:00:00Z'), 'dd/MM/yyyy') 
    : '-';

  // Cabeçalho
  doc.setFillColor(245, 246, 248);
  doc.rect(0, 0, 210, 38, "F");

  doc.setFontSize(18);
  doc.setTextColor(31, 41, 55);
  doc.text("Ficha da Operação por Volume", 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Identificador: #${opId} | Emissão: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 27);

  // Bloco 1: Informações Gerais
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text("Dados da Operação", 14, 46);

  const dadosGerais = [
    ["Cliente / Empresa:", clienteNome, "Data Operação:", dataOp],
    ["Serviço:", op.tipos_servico_operacional?.nome || op.tipo_servico_label || "-", "Volume / Qtd:", String(op.quantidade ?? 0)],
    ["Transportadora:", op.transportadoras_clientes?.nome || op.transportadora_label || "-", "Placa:", op.placa || "-"],
    ["Nota Fiscal (NF):", op.nf_numero || "-", "CTRC:", op.ctrc || "-"],
    ["Entrada:", (op.entrada_ponto || "").substring(0, 5) || "-", "Saída:", (op.saida_ponto || "").substring(0, 5) || "-"],
    ["Encarregado:", op.responsavel_nome || "-", "Qtd. Colaboradores:", String(op.quantidade_colaboradores ?? 1)],
  ];

  autoTable(doc, {
    startY: 50,
    body: dadosGerais,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 40 },
      1: { textColor: [31, 41, 55], cellWidth: 65 },
      2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 40 },
      3: { textColor: [31, 41, 55], cellWidth: 45 },
    },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 8;

  // Bloco 2: Colaboradores Envolvidos (se houver)
  const colaboradores = op.colaboradores_vinculados || op.production_entry_collaborators || [];
  if (colaboradores.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(`Colaboradores Vinculados (${colaboradores.length})`, 14, currentY);

    const colabRows = colaboradores.map((c: any) => {
      const nome = c.colaboradores?.nome || c.nome || "Colaborador";
      const cargo = c.colaboradores?.cargo || c.cargo || "-";
      const entrada = (c.entrada_ponto || op.entrada_ponto || "").substring(0, 5) || "-";
      const saida = (c.saida_ponto || op.saida_ponto || "").substring(0, 5) || "-";
      return [nome, cargo, entrada, saida];
    });

    autoTable(doc, {
      startY: currentY + 3,
      head: [["Nome", "Cargo / Função", "Entrada", "Saída"]],
      body: colabRows,
      headStyles: { fillColor: [51, 65, 85], fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 8, cellPadding: 2.5 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Bloco 3: Resumo Financeiro & Status
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text("Resumo Financeiro e Status", 14, currentY);

  const valorUnit = Number(op.valor_unitario_snapshot ?? op.valor_unitario ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const valorTotal = Number(op.total_final ?? op.valor_total ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const statusGeral = op.status || 'PENDENTE';
  const statusRh = op.status_rh || 'PENDENTE_RH';
  const statusPgto = op.status_pagamento || 'PENDENTE';

  const dadosFinanceiros = [
    ["Valor Unitário:", valorUnit, "Valor Total da Operação:", valorTotal],
    ["Forma de Pagamento:", op.forma_pagamento || "-", "Modalidade:", op.modalidade_financeira || op.modalidade || "-"],
    ["Status Operacional:", statusGeral, "Status Validação RH:", statusRh],
    ["Status Pagamento:", statusPgto, "Data Pagamento:", op.data_pagamento ? format(new Date(op.data_pagamento + 'T12:00:00Z'), 'dd/MM/yyyy') : '-'],
  ];

  autoTable(doc, {
    startY: currentY + 3,
    body: dadosFinanceiros,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 45 },
      1: { textColor: [31, 41, 55], cellWidth: 55 },
      2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 45 },
      3: { textColor: [31, 41, 55], cellWidth: 45 },
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Observações (se houver)
  if (op.observacao) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Observação: ${op.observacao}`, 14, currentY, { maxWidth: 180 });
  }

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text("Documento operacional gerado eletronicamente pelo ERP ORBE.", 14, 285);

  doc.save(`Ficha_Operacao_${opId}.pdf`);
};
