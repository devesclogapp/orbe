import { describe, it, expect } from 'vitest';

describe('FIX-RET-05: Segregação de Domínio de Lotes e Blindagem de FK na Auditoria Bancária', () => {
  // Simulação rigorosa do PostgreSQL Schema com as constraints reais
  interface SchemaState {
    lotes_remessa: Set<string>; // Tabela referenciada pela FK cnab_auditoria_bancaria_lote_id_fkey
    intermitentes_lotes_fechamento: Set<string>; // Tabela operacional desacoplada
    diaristas_lotes_fechamento: Set<string>; // Tabela operacional desacoplada
    cnab_auditoria_bancaria: Array<{
      lote_id: string | null;
      detalhes: Record<string, any>;
    }>;
  }

  function simulatePostgresAuditInsert(
    schema: SchemaState,
    params: {
      remessa_lote_id: string | null;
      remessa_intermitentes_id: string | null;
      remessa_diaristas_id: string | null;
      useLegacyCoalesce: boolean;
    }
  ) {
    let loteIdToInsert: string | null = null;

    if (params.useLegacyCoalesce) {
      // Comportamento vulnerável legado (FIX-RET-03):
      loteIdToInsert = params.remessa_intermitentes_id || params.remessa_diaristas_id || params.remessa_lote_id;
    } else {
      // Comportamento seguro corrigido (FIX-RET-05):
      loteIdToInsert = params.remessa_lote_id;
    }

    // Validação estrita da FK real: cnab_auditoria_bancaria_lote_id_fkey REFERENCES lotes_remessa(id)
    if (loteIdToInsert !== null && !schema.lotes_remessa.has(loteIdToInsert)) {
      const err = new Error(
        'insert or update on table "cnab_auditoria_bancaria" violates foreign key constraint "cnab_auditoria_bancaria_lote_id_fkey"'
      );
      (err as any).code = '23503';
      throw err;
    }

    // Gravação segura no JSONB detalhes (preservando rastreabilidade)
    const detalhes = {
      lote_id: params.remessa_lote_id,
      intermitentes_lote_id: params.remessa_intermitentes_id,
      diaristas_lote_id: params.remessa_diaristas_id,
    };

    schema.cnab_auditoria_bancaria.push({ lote_id: loteIdToInsert, detalhes });
    return true;
  }

  it('1. Cenário NSA 10 (Intermitentes): a versão legada com COALESCE causa violação da FK 23503', () => {
    const schema: SchemaState = {
      lotes_remessa: new Set(['lote-clt-folha-01']),
      intermitentes_lotes_fechamento: new Set(['183c011a-53ea-41da-b76f-aea686362f38']),
      diaristas_lotes_fechamento: new Set(),
      cnab_auditoria_bancaria: [],
    };

    expect(() => {
      simulatePostgresAuditInsert(schema, {
        remessa_lote_id: null,
        remessa_intermitentes_id: '183c011a-53ea-41da-b76f-aea686362f38',
        remessa_diaristas_id: null,
        useLegacyCoalesce: true,
      });
    }).toThrowError('cnab_auditoria_bancaria_lote_id_fkey');
  });

  it('2. Cenário NSA 10 (Intermitentes) na FIX-RET-05: lote_id é gravado como NULL e a FK é respeitada com sucesso', () => {
    const schema: SchemaState = {
      lotes_remessa: new Set(['lote-clt-folha-01']),
      intermitentes_lotes_fechamento: new Set(['183c011a-53ea-41da-b76f-aea686362f38']),
      diaristas_lotes_fechamento: new Set(),
      cnab_auditoria_bancaria: [],
    };

    const res = simulatePostgresAuditInsert(schema, {
      remessa_lote_id: null,
      remessa_intermitentes_id: '183c011a-53ea-41da-b76f-aea686362f38',
      remessa_diaristas_id: null,
      useLegacyCoalesce: false,
    });

    expect(res).toBe(true);
    expect(schema.cnab_auditoria_bancaria.length).toBe(1);
    expect(schema.cnab_auditoria_bancaria[0].lote_id).toBeNull();
    expect(schema.cnab_auditoria_bancaria[0].detalhes.intermitentes_lote_id).toBe('183c011a-53ea-41da-b76f-aea686362f38');
  });

  it('3. Cenário Diaristas na FIX-RET-05: lote_id é gravado como NULL e diaristas_lote_id é preservado em detalhes', () => {
    const schema: SchemaState = {
      lotes_remessa: new Set(['lote-clt-folha-01']),
      intermitentes_lotes_fechamento: new Set(),
      diaristas_lotes_fechamento: new Set(['diaristas-lote-semana-42']),
      cnab_auditoria_bancaria: [],
    };

    const res = simulatePostgresAuditInsert(schema, {
      remessa_lote_id: null,
      remessa_intermitentes_id: null,
      remessa_diaristas_id: 'diaristas-lote-semana-42',
      useLegacyCoalesce: false,
    });

    expect(res).toBe(true);
    expect(schema.cnab_auditoria_bancaria[0].lote_id).toBeNull();
    expect(schema.cnab_auditoria_bancaria[0].detalhes.diaristas_lote_id).toBe('diaristas-lote-semana-42');
  });

  it('4. Cenário Folha CLT na FIX-RET-05: lote_id existe em lotes_remessa e é persistido normalmente na FK', () => {
    const schema: SchemaState = {
      lotes_remessa: new Set(['lote-clt-folha-01']),
      intermitentes_lotes_fechamento: new Set(),
      diaristas_lotes_fechamento: new Set(),
      cnab_auditoria_bancaria: [],
    };

    const res = simulatePostgresAuditInsert(schema, {
      remessa_lote_id: 'lote-clt-folha-01',
      remessa_intermitentes_id: null,
      remessa_diaristas_id: null,
      useLegacyCoalesce: false,
    });

    expect(res).toBe(true);
    expect(schema.cnab_auditoria_bancaria[0].lote_id).toBe('lote-clt-folha-01');
    expect(schema.cnab_auditoria_bancaria[0].detalhes.lote_id).toBe('lote-clt-folha-01');
  });
});
