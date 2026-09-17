import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateOnly } from '@/utils/financeiro';

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
    
    // Dates & Values (Zero timezone shift via formatDateOnly)
    const rawVenc = vencimento || receita.vencimento;
    const vencText = rawVenc ? formatDateOnly(rawVenc) : 'À Vista / Imediato';
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

    // Items Table (Memória de Cálculo Fiel)
    const itens = detalhesReceita?.receitas_operacionais_itens || [];
    
    let tableData: string[][] = [];
    if (itens.length > 0) {
        itens.forEach((item: any) => {
            const op = item.operacoes_producao;
            if (op) {
                const dataOpStr = formatDateOnly(op.data_operacao);
                const servicoNome = op.servicos?.nome || op.servicos?.descricao || 'Serviço Operacional';
                const produtoNome = op.produtos?.nome || op.produtos?.descricao;
                const descOp = produtoNome ? `${servicoNome} - ${produtoNome}` : servicoNome;
                
                const qtd = op.quantidade ? String(op.quantidade) : "1";
                const unitValor = Number(op.valor_unitario_snapshot ?? op.valor_unitario ?? 0);
                const unitStr = unitValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                
                // Subtotal da descarga / operação principal
                const subtotalOp = Number(op.valor_descarga ?? (Number(op.quantidade || 1) * unitValor));
                const subtotalOpStr = subtotalOp.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                // Linha 1: Serviço / Descarga
                tableData.push([
                    dataOpStr,
                    descOp,
                    qtd,
                    unitStr,
                    subtotalOpStr
                ]);

                // Linha 2 (Opcional): Materiais
                const valorMateriais = Number(
                    op.valor_total_materiais ||
                    op.valor_total_filme ||
                    op.valor_materiais ||
                    op.custo_materiais ||
                    0
                );
                if (valorMateriais > 0) {
                    const qtdFilme = Number(op.quantidade_filme || 0) > 0 ? String(op.quantidade_filme) : "-";
                    const unitFilme = Number(op.valor_unitario_filme || 0) > 0 
                        ? Number(op.valor_unitario_filme).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                        : "-";
                    tableData.push([
                        "-",
                        "Materiais",
                        qtdFilme,
                        unitFilme,
                        valorMateriais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    ]);
                }

                // Linha 3 (Opcional): ISS
                const valorIss = Number(op.custo_com_iss ?? op.valor_iss ?? 0);
                if (valorIss > 0) {
                    const rawPct = op.percentual_iss != null ? Number(op.percentual_iss) : null;
                    const pctLabel = rawPct != null 
                        ? ` (${Math.round(rawPct <= 1 ? rawPct * 100 : rawPct)}%)` 
                        : "";
                    tableData.push([
                        "-",
                        `ISS${pctLabel}`,
                        "-",
                        "-",
                        valorIss.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    ]);
                }
            } else if (item.servicos_extras_operacionais) {
                const se = item.servicos_extras_operacionais;
                const dataSeStr = formatDateOnly(se.data || se.data_servico);
                const tipoNome = se.tipo_servico || 'Serviço Extra';
                const descCompleta = se.descricao ? `${tipoNome} — ${se.descricao}` : tipoNome;
                const qtd = se.quantidade ? String(se.quantidade) : "1";
                const unitValor = Number(se.valor_unitario || 0);
                const unitStr = unitValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const subtotalSe = Number(item.valor_item ?? se.valor_total ?? (Number(se.quantidade || 1) * unitValor));
                const subtotalSeStr = subtotalSe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                tableData.push([
                    dataSeStr,
                    descCompleta,
                    qtd,
                    unitStr,
                    subtotalSeStr
                ]);
            } else {
                tableData.push([
                    "-",
                    item.descricao_item || "Faturamento Avulso / Consolidado",
                    "1",
                    Number(item.valor_item || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    Number(item.valor_item || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                ]);
            }
        });
    } else {
        tableData = [
            ['-', 'Faturamento Avulso / Consolidado', '1', valorStr, valorStr]
        ];
    }
    
    autoTable(doc, {
      startY: 85,
      margin: { left: 14, right: 14 },
      head: [["Data", "Descrição", "Qtd", "V. Unitário", "Subtotal"]],
      body: tableData,
      foot: [["", "TOTAL DA FATURA", "", "", valorStr]],
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [29, 78, 216],
        fontStyle: 'bold',
        fontSize: 10,
        valign: 'middle'
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        overflow: 'linebreak',
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'center' },
        1: { cellWidth: 78, halign: 'left' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 31, halign: 'right' }
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;

    // Footer / Payment Info (Neutro, fiel e sem dados bancários fictícios)
    let boxY = finalY + 12;
    if (boxY + 35 > 270) {
        doc.addPage();
        boxY = 20;
    }

    doc.setFillColor(245, 247, 250);
    doc.rect(14, boxY, 182, 32, "F");
    
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text("Instruções e Condições de Pagamento", 18, boxY + 8);
    
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.text("Fatura referente aos serviços operacionais prestados.", 18, boxY + 15);
    doc.text(`Vencimento: ${vencText} | Valor Total: ${valorStr}`, 18, boxY + 21);
    doc.text("Pagamento conforme condições comerciais acordadas.", 18, boxY + 27);
    
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`Gerado pelo sistema ORBE em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 280);

    const fileName = `Fatura_${clienteNome.replace(/\s+/g, "_").toLowerCase()}_${compText.replace('/', '_')}_${numDocumento}.pdf`;
    doc.save(fileName);
};
