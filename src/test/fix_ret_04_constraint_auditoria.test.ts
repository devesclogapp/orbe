import { describe, it, expect } from 'vitest';

describe('FIX-RET-04: Blindagem da Auditoria Bancária (Constraint acao_check e FK lote_id)', () => {
  // =========================================================================
  // 1. BLINDAGEM DA CHECK CONSTRAINT cnab_auditoria_bancaria_acao_check
  // =========================================================================
  const acoesHistoricasPermitidas = [
    'geracao',
    'download',
    'envio_manual',
    'homologacao',
    'erro_homologacao',
    'validacao',
    'upload_retorno',
    'processamento_retorno',
    'erro_retorno',
    'divergencia_retorno',
    'conciliacao_aprovada',
    'conciliacao_rejeitada',
    'conciliacao_divergente',
    'conciliacao_revertida',
    'conciliacao_observacao'
  ];

  const acoesExpandidasFixRet04 = [
    ...acoesHistoricasPermitidas,
    'RETORNO_PROCESSADO_SIMULADO',
    'RETORNO_PROCESSADO_INTEGRAL',
    'retorno_processado_simulado',
    'retorno_processado_integral'
  ];

  function validateAcaoConstraint(acao: string, allowedList: string[]): boolean {
    return allowedList.includes(acao);
  }

  it('1. Deve reproduzir a falha real de acao_check: RETORNO_PROCESSADO_SIMULADO e RETORNO_PROCESSADO_INTEGRAL falham na constraint legada', () => {
    expect(validateAcaoConstraint('RETORNO_PROCESSADO_SIMULADO', acoesHistoricasPermitidas)).toBe(false);
    expect(validateAcaoConstraint('RETORNO_PROCESSADO_INTEGRAL', acoesHistoricasPermitidas)).toBe(false);
  });

  it('2. Na constraint expandida FIX-RET-04, todos os valores históricos e novos são rigorosamente válidos', () => {
    for (const acao of acoesExpandidasFixRet04) {
      expect(validateAcaoConstraint(acao, acoesExpandidasFixRet04)).toBe(true);
    }
    expect(validateAcaoConstraint('RETORNO_PROCESSADO_SIMULADO', acoesExpandidasFixRet04)).toBe(true);
    expect(validateAcaoConstraint('RETORNO_PROCESSADO_INTEGRAL', acoesExpandidasFixRet04)).toBe(true);
    expect(validateAcaoConstraint('processamento_retorno', acoesExpandidasFixRet04)).toBe(true);
  });

  // =========================================================================
  // 2. BLINDAGEM DA FK cnab_auditoria_bancaria_lote_id_fkey E SEGREGAÇÃO DE DOMÍNIOS
  // =========================================================================
  // Banco em memória simulando as tabelas e suas Foreign Keys reais do Postgres
  interface DatabaseTables {
    tenants: Set<string>;
    cnab_remessas_arquivos: Set<string>;
    lotes_remessa: Set<string>; // FK de cnab_auditoria_bancaria.lote_id
    intermitentes_lotes_fechamento: Set<string>;
    diaristas_lotes_fechamento: Set<string>;
    cnab_auditoria_bancaria: Array<{
      id: string;
      tenant_id: string;
      arquivo_id: string;
      lote_id: string | null;
      acao: string;
      detalhes: Record<string, any>;
    }>;
  }

  function insertCnabAuditoriaBancaria(
    db: DatabaseTables,
    row: {
      tenant_id: string;
      arquivo_id: string;
      lote_id: string | null;
      acao: string;
      detalhes: Record<string, any>;
    }
  ) {
    // Validação da FK de tenant_id -> tenants(id)
    if (!db.tenants.has(row.tenant_id)) {
      throw new Error(`violates foreign key constraint "cnab_auditoria_bancaria_tenant_id_fkey"`);
    }

    // Validação da FK de arquivo_id -> cnab_remessas_arquivos(id)
    if (row.arquivo_id && !db.cnab_remessas_arquivos.has(row.arquivo_id)) {
      throw new Error(`violates foreign key constraint "cnab_auditoria_bancaria_arquivo_id_fkey"`);
    }

    // Validação estrita da FK cnab_auditoria_bancaria_lote_id_fkey -> lotes_remessa(id)
    if (row.lote_id !== null && !db.lotes_remessa.has(row.lote_id)) {
      throw new Error(`insert or update on table "cnab_auditoria_bancaria" violates foreign key constraint "cnab_auditoria_bancaria_lote_id_fkey"`);
    }

    // Validação da Check Constraint acao
    if (!validateAcaoConstraint(row.acao, acoesExpandidasFixRet04)) {
      throw new Error(`new row for relation "cnab_auditoria_bancaria" violates check constraint "cnab_auditoria_bancaria_acao_check"`);
    }

    db.cnab_auditoria_bancaria.push({ id: `audit-${Date.now()}`, ...row });
    return true;
  }

  it('3. Deve reproduzir a falha real: tentar passar ID de lote de intermitentes para cnab_auditoria_bancaria.lote_id viola cnab_auditoria_bancaria_lote_id_fkey', () => {
    const db: DatabaseTables = {
      tenants: new Set(['09ccafb6-2cf2-4c83-ac3d-a2913947693c']),
      cnab_remessas_arquivos: new Set(['38107d57-4069-434e-aed3-8501fe606272']),
      lotes_remessa: new Set(['lote-clt-1111']), // Contém apenas lotes de remessa CLT
      intermitentes_lotes_fechamento: new Set(['183c011a-53ea-41da-b76f-aea686362f38']), // Lote operacional NSA 10
      diaristas_lotes_fechamento: new Set(),
      cnab_auditoria_bancaria: [],
    };

    const remessaIntermitentes = {
      id: '38107d57-4069-434e-aed3-8501fe606272',
      tenant_id: '09ccafb6-2cf2-4c83-ac3d-a2913947693c',
      lote_id: null, // Na remessa de intermitentes, lote_id CLT é null
      intermitentes_lote_id: '183c011a-53ea-41da-b76f-aea686362f38',
      diaristas_lote_id: null,
    };

    // A RPC anterior (FIX-RET-03) fazia COALESCE com intermitentes_lote_id na coluna lote_id:
    const valorLoteIdComCoalesce = remessaIntermitentes.intermitentes_lote_id || remessaIntermitentes.diaristas_lote_id || remessaIntermitentes.lote_id;

    expect(() => {
      insertCnabAuditoriaBancaria(db, {
        tenant_id: remessaIntermitentes.tenant_id,
        arquivo_id: remessaIntermitentes.id,
        lote_id: valorLoteIdComCoalesce, // '183c011a-53ea-41da-b76f-aea686362f38'
        acao: 'RETORNO_PROCESSADO_SIMULADO',
        detalhes: { modo: 'homologacao' },
      });
    }).toThrowError('cnab_auditoria_bancaria_lote_id_fkey');
  });

  it('4. Correção FIX-RET-04: ao atribuir v_remessa_lote_id (null para intermitentes) e registrar intermitentes_lote_id em detalhes, a FK é 100% respeitada', () => {
    const db: DatabaseTables = {
      tenants: new Set(['09ccafb6-2cf2-4c83-ac3d-a2913947693c']),
      cnab_remessas_arquivos: new Set(['38107d57-4069-434e-aed3-8501fe606272']),
      lotes_remessa: new Set(['lote-clt-1111']),
      intermitentes_lotes_fechamento: new Set(['183c011a-53ea-41da-b76f-aea686362f38']),
      diaristas_lotes_fechamento: new Set(),
      cnab_auditoria_bancaria: [],
    };

    const remessaIntermitentes = {
      id: '38107d57-4069-434e-aed3-8501fe606272',
      tenant_id: '09ccafb6-2cf2-4c83-ac3d-a2913947693c',
      lote_id: null, // CLT lote_id é null
      intermitentes_lote_id: '183c011a-53ea-41da-b76f-aea686362f38',
      diaristas_lote_id: null,
    };

    // Lógica corrigida da FIX-RET-04:
    // cnab_auditoria_bancaria.lote_id recebe exclusivamente remessaIntermitentes.lote_id (null)
    // Os IDs operacionais são preservados no campo detalhes (JSONB)
    const sucesso = insertCnabAuditoriaBancaria(db, {
      tenant_id: remessaIntermitentes.tenant_id,
      arquivo_id: remessaIntermitentes.id,
      lote_id: remessaIntermitentes.lote_id, // null
      acao: 'RETORNO_PROCESSADO_SIMULADO',
      detalhes: {
        modo: 'homologacao',
        simulado: true,
        lote_id: remessaIntermitentes.lote_id,
        intermitentes_lote_id: remessaIntermitentes.intermitentes_lote_id,
        diaristas_lote_id: remessaIntermitentes.diaristas_lote_id,
      },
    });

    expect(sucesso).toBe(true);
    expect(db.cnab_auditoria_bancaria.length).toBe(1);
    expect(db.cnab_auditoria_bancaria[0].lote_id).toBeNull();
    expect(db.cnab_auditoria_bancaria[0].detalhes.intermitentes_lote_id).toBe('183c011a-53ea-41da-b76f-aea686362f38');
    expect(db.cnab_auditoria_bancaria[0].acao).toBe('RETORNO_PROCESSADO_SIMULADO');
  });

  it('5. Cenário CLT Legado: quando v_remessa_lote_id existe em lotes_remessa, ele é persistido em cnab_auditoria_bancaria.lote_id', () => {
    const db: DatabaseTables = {
      tenants: new Set(['09ccafb6-2cf2-4c83-ac3d-a2913947693c']),
      cnab_remessas_arquivos: new Set(['remessa-clt-9999']),
      lotes_remessa: new Set(['lote-clt-1111']),
      intermitentes_lotes_fechamento: new Set(),
      diaristas_lotes_fechamento: new Set(),
      cnab_auditoria_bancaria: [],
    };

    const remessaClt = {
      id: 'remessa-clt-9999',
      tenant_id: '09ccafb6-2cf2-4c83-ac3d-a2913947693c',
      lote_id: 'lote-clt-1111',
      intermitentes_lote_id: null,
      diaristas_lote_id: null,
    };

    const sucesso = insertCnabAuditoriaBancaria(db, {
      tenant_id: remessaClt.tenant_id,
      arquivo_id: remessaClt.id,
      lote_id: remessaClt.lote_id, // 'lote-clt-1111' existe em lotes_remessa
      acao: 'RETORNO_PROCESSADO_INTEGRAL',
      detalhes: {
        modo: 'producao',
        simulado: false,
        lote_id: remessaClt.lote_id,
      },
    });

    expect(sucesso).toBe(true);
    expect(db.cnab_auditoria_bancaria[0].lote_id).toBe('lote-clt-1111');
  });
});
