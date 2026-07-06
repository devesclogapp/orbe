import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const generateCobrancaPDF = (receita: any, detalhesReceita: any, formato: string, vencimento?: string) => {
    const doc = new jsPDF("p", "mm", "a4");

    const clienteNome = receita.empresas?.nome || 'Cliente Não Identificado';
    const numDocumento = receita.id?.substring(0, 8).toUpperCase() || 'S/N';
    
    // Header
    doc.setFillColor(245, 246, 248);
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55);
    doc.text("Documento de Cobrança", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fatura #${numDocumento} | Formato: ${formato}`, 14, 28);
    
    // Dates & Values
    const vencText = vencimento ? format(new Date(vencimento + 'T12:00:00Z'), 'dd/MM/yyyy') : 'À Vista / Imediato';
    const compText = receita.competencia || 'Avulsa';
    
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text(`Cliente: ${clienteNome}`, 14, 50);
    doc.text(`Competência: ${compText}`, 14, 56);
    doc.text(`Vencimento: ${vencText}`, 14, 62);
    
    doc.setFontSize(14);
    doc.setTextColor(29, 78, 216);
    const valorStr = Number(receita.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    doc.text(`Total a Pagar: ${valorStr}`, 14, 72);

    // Items Table
    const itens = detalhesReceita?.receitas_operacionais_itens || [];
    
    let tableData = [];
    if (itens.length > 0) {
        tableData = itens.map((item: any) => {
            const op = item.operacoes_producao;
            const desc = op ? `${op.servicos?.nome || op.servicos?.descricao || 'Serviço'} - ${op.produtos?.nome || op.produtos?.descricao || 'Produto'}` : 'Operação Avulsa (Consolidado)';
            const qtd = op?.quantidade || 1;
            const vUnit = item.valor_item / qtd;
            return [
                op?.data_operacao ? format(new Date(op.data_operacao), 'dd/MM/yyyy') : '-',
                desc.substring(0, 45),
                qtd.toString(),
                Number(vUnit).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                Number(item.valor_item).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            ];
        });
    } else {
        tableData = [
            ['-', 'Faturamento Avulso / Consolidado', '1', valorStr, valorStr]
        ];
    }
    
    autoTable(doc, {
      startY: 85,
      head: [["Data", "Descrição da Operação", "Qtd", "V. Unitário", "Subtotal"]],
      body: tableData,
      headStyles: { fillColor: [51, 65, 85] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 4 },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;

    // Footer / Payment Info
    doc.setFillColor(240, 253, 244);
    doc.rect(14, finalY + 15, 182, 40, "F");
    
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61);
    doc.text("Instruções de Pagamento", 18, finalY + 23);
    
    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    doc.text(`Por favor, realize o pagamento no valor de ${valorStr} até a data de vencimento.`, 18, finalY + 31);
    doc.text("Pagamento via PIX: Utilize a chave CNPJ 00.000.000/0001-00 (ORBE Logística).", 18, finalY + 37);
    doc.text("Após o pagamento, o sistema identificará e confirmará o recebimento automaticamente caso aplicável.", 18, finalY + 43);
    
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Gerado pelo sistema ORBE em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 280);

    const fileName = `Fatura_${clienteNome.replace(/\s+/g, "_").toLowerCase()}_${compText.replace('/', '_')}_${numDocumento}.pdf`;
    doc.save(fileName);
};
