import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('CONV-06 FIX 00 — Auditoria e Validação Fail-Closed do Resolver de Aprovação', () => {
  const aprovacoesRhPath = path.resolve(__dirname, '../pages/Rh/AprovacoesRh.tsx');
  const drawerPath = path.resolve(__dirname, '../components/aprovacoes/AprovacaoDecisaoDrawer.tsx');

  const fileContent = fs.readFileSync(aprovacoesRhPath, 'utf-8');
  const drawerContent = fs.readFileSync(drawerPath, 'utf-8');

  describe('1. P0-01 — Fail-Closed em aprovarMutation', () => {
    it('1.1 aprovarMutation deve possuir lançamento de exceção explícito para tipos não reconhecidos (Fail-Closed)', () => {
      const aprovarStart = fileContent.indexOf('const aprovarMutation = useMutation');
      const aprovarEnd = fileContent.indexOf('const devolverMutation = useMutation', aprovarStart);
      const mutationBlock = fileContent.substring(aprovarStart, aprovarEnd);

      expect(mutationBlock).toContain('throw new Error(`Não foi possível identificar o fluxo de aprovação');
      expect(mutationBlock).toContain('Nenhuma alteração foi realizada.');
    });

    it('1.2 aprovarMutation deve preservar os 6 domínios canônicos homologados', () => {
      const aprovarStart = fileContent.indexOf('const aprovarMutation = useMutation');
      const aprovarEnd = fileContent.indexOf('const devolverMutation = useMutation', aprovarStart);
      const mutationBlock = fileContent.substring(aprovarStart, aprovarEnd);

      // 1. DIARISTA
      expect(mutationBlock).toContain('item.tipo === "DIARISTA"');
      expect(mutationBlock).toContain('diaristas_lotes_fechamento');
      expect(mutationBlock).toContain('lancamentos_diaristas');
      expect(mutationBlock).toContain('status: "VALIDADO_RH"');

      // 2. INTERMITENTE
      expect(mutationBlock).toContain('item.tipo === "INTERMITENTE"');
      expect(mutationBlock).toContain('IntermitentesLoteService.validarLote');

      // 3. PONTO
      expect(mutationBlock).toContain('item.tipo === "PONTO"');
      expect(mutationBlock).toContain('registros_ponto');
      expect(mutationBlock).toContain('status_processamento: "PROCESSADO"');

      // 4. CUSTO EXTRA
      expect(mutationBlock).toContain('item.tipo === "CUSTO EXTRA"');
      expect(mutationBlock).toContain('custos_extras_operacionais');
      expect(mutationBlock).toContain('rpc_custo_extra_transicionar');

      // 5. SERVIÇO EXTRA
      expect(mutationBlock).toContain('item.tipo === "SERVIÇO EXTRA"');
      expect(mutationBlock).toContain('servicos_extras_operacionais');
      expect(mutationBlock).toContain('pipeline_status: "APROVADO_OPERACAO"');

      // 6. OPERAÇÃO
      expect(mutationBlock).toContain('item.tipo === "OPERAÇÃO"');
      expect(mutationBlock).toContain('rpc_rh_aprovar_operacao');
    });
  });

  describe('2. P0-01 — Fail-Closed em devolverMutation', () => {
    it('2.1 devolverMutation deve possuir lançamento de exceção explícito para tipos não reconhecidos (Fail-Closed)', () => {
      const devolverStart = fileContent.indexOf('const devolverMutation = useMutation');
      const devolverEnd = fileContent.indexOf('handleBulkAprovar', devolverStart);
      const mutationBlock = fileContent.substring(devolverStart, devolverEnd);

      expect(mutationBlock).toContain('throw new Error(`Não foi possível identificar o fluxo de devolução');
      expect(mutationBlock).toContain('Nenhuma alteração foi realizada.');
    });

    it('2.2 devolverMutation deve preservar os 6 domínios canônicos homologados', () => {
      const devolverStart = fileContent.indexOf('const devolverMutation = useMutation');
      const devolverEnd = fileContent.indexOf('handleBulkAprovar', devolverStart);
      const mutationBlock = fileContent.substring(devolverStart, devolverEnd);

      // 1. DIARISTA
      expect(mutationBlock).toContain('item.tipo === "DIARISTA"');
      expect(mutationBlock).toContain('diaristas_lotes_fechamento');
      expect(mutationBlock).toContain('status: "AGUARDANDO_VALIDACAO_RH"');

      // 2. INTERMITENTE
      expect(mutationBlock).toContain('item.tipo === "INTERMITENTE"');
      expect(mutationBlock).toContain('IntermitentesLoteService.devolverLote');

      // 3. PONTO
      expect(mutationBlock).toContain('item.tipo === "PONTO"');
      expect(mutationBlock).toContain('registros_ponto');
      expect(mutationBlock).toContain('status_processamento: "INCONSISTENTE"');

      // 4. CUSTO EXTRA
      expect(mutationBlock).toContain('item.tipo === "CUSTO EXTRA"');
      expect(mutationBlock).toContain('custos_extras_operacionais');
      expect(mutationBlock).toContain('pipeline_status: "REPROVADO"');

      // 5. SERVIÇO EXTRA
      expect(mutationBlock).toContain('item.tipo === "SERVIÇO EXTRA"');
      expect(mutationBlock).toContain('servicos_extras_operacionais');
      expect(mutationBlock).toContain('pipeline_status: "DEVOLVIDO"');

      // 6. OPERAÇÃO
      expect(mutationBlock).toContain('item.tipo === "OPERAÇÃO"');
      expect(mutationBlock).toContain('rpc_rh_devolver_operacao');
    });
  });

  describe('3. P1 — Correção da Coluna Data de Recebimento', () => {
    it('3.1 ItensTable deve referenciar data_recebimento (snake_case) com fmtDate e não a propriedade inexistente dataRecebimento', () => {
      expect(aprovacoesRhPath).not.toContain('{item.dataRecebimento}');
      expect(fileContent).toContain('fmtDate(item.data_recebimento)');
    });

    it('3.2 Interface ApprovalItem define data_recebimento canônica', () => {
      expect(drawerContent).toContain('data_recebimento: string;');
    });
  });

  describe('4. Preservação de Não-Regressão e Contratos', () => {
    it('4.1 Tipos de itens suportados permanecem estritamente restritos aos 6 domínios homologados', () => {
      expect(drawerContent).toContain('type TipoItem = "PONTO" | "DIARISTA" | "INTERMITENTE" | "CUSTO EXTRA" | "SERVIÇO EXTRA" | "OPERAÇÃO";');
    });

    it('4.2 Toast de erro é disparado em onError para aprovarMutation e devolverMutation', () => {
      expect(fileContent).toContain('onError: (err: any) => {');
      expect(fileContent).toContain('toast.error("Erro ao aprovar.');
      expect(fileContent).toContain('toast.error("Erro ao devolver.');
    });
  });
});
