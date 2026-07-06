import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const generateFaturaLotePDF = async (
    consolidadoRow: any,
    operacoes?: any[]
) => {
    const doc = new jsPDF("p", "mm", "a4");

    const clienteNome = consolidadoRow.clientes?.nome || 'Cliente Não Identificado';
    const compText = consolidadoRow.competencia || '';
    
    // Header
    doc.setFillColor(245, 246, 248);
    doc.rect(0, 0, 210, 45, "F");
    
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55);
    doc.text("Fatura de Serviços", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Faturamento Fechado (Lote) | Emissão: ${format(new Date(), 'dd/MM/yyyy')}`, 14, 28);
    
    // Info Block
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text(`Cliente: ${clienteNome}`, 14, 55);
    doc.text(`Competência: ${compText}`, 14, 61);
    doc.text(`Status Lote: ${consolidadoRow.status?.toUpperCase() || 'ABERTO'}`, 14, 67);
    
    doc.setFontSize(14);
    doc.setTextColor(29, 78, 216);
    const valorStr = Number(consolidadoRow.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    doc.text(`Total Faturado: ${valorStr}`, 14, 77);

    // Summary block (Base / Regras)
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Valor Base das Operações: ${Number(consolidadoRow.valor_base || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 85);
    doc.text(`Acréscimos / Descontos (Regras): ${Number(consolidadoRow.valor_regras || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, 90);
    doc.text(`Qtd. de Operações Envolvidas: ${consolidadoRow.quantidade_operacoes || 0}`, 14, 95);

    let finalY = 105;

    // Items Table (if operations are provided)
    if (operacoes && operacoes.length > 0) {
        const tableData = operacoes.map((op: any) => {
            const desc = `${op.tipos_servico_operacional?.nome || 'Serviço'} / ${op.produtos_carga?.nome || op.unidades?.nome || 'Geral'}`;
            const dt = op.criado_em ? format(new Date(op.criado_em), 'dd/MM') : '-';
            const qtd = op.quantidade || 1;
            const vUn = Number(op.valor_unitario || 0);
            const vTot = Number(op.valor_total_liquido || op.valor_total || 0);
            return [
                dt,
                desc.substring(0, 50),
                qtd.toString(),
                vUn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                vTot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            ];
        });
        
        autoTable(doc, {
            startY: finalY,
            head: [["Data", "Descrição da Operação", "Qtd", "V. Unit", "Subtotal"]],
            body: tableData,
            headStyles: { fillColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            styles: { fontSize: 8, cellPadding: 3 },
        });

        finalY = (doc as any).lastAutoTable.finalY + 15;
    } else {
        doc.setFontSize(10);
        doc.setTextColor(156, 163, 175);
        doc.text("Detalhamento analítico não incluso. (Resumo Consolidado)", 14, finalY);
        finalY += 15;
    }

    // Footer / Payment Info
    if (finalY > 240) {
        doc.addPage();
        finalY = 20;
    }

    doc.setFillColor(240, 253, 244);
    doc.rect(14, finalY, 182, 40, "F");
    
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61);
    doc.text("Instruções ao Cliente", 18, finalY + 8);
    
    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    doc.text(`Fatura consolidada referente a ${consolidadoRow.quantidade_operacoes} operações no período.`, 18, finalY + 16);
    doc.text(`Pagamento via PIX: Chave CNPJ 00.000.000/0001-00 (ORBE Logística).`, 18, finalY + 22);
    doc.text(`Valor total devido: ${valorStr}`, 18, finalY + 28);
    
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 280);

    const fileName = `Fatura_Consolidada_${clienteNome.replace(/\s+/g, "_").toLowerCase()}_${compText}.pdf`;
    doc.save(fileName);
};
