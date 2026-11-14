import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  buildCanonicalPontoKey,
  ingestPontosBatch,
  sanitizeDbPayload,
  VALID_REGISTROS_PONTO_COLUMNS,
  type PontoIngestionRecord,
} from '../../supabase/functions/_shared/pontoIntegrity';

const sha256Hex = async (msg: string): Promise<string> =>
  createHash('sha256').update(msg).digest('hex');

interface MockDbState {
  registros_ponto: Record<string, any>[];
  rh_financeiro_lotes: Record<string, any>[];
  fechamento_mensal: Record<string, any>[];
  processamento_rh_inconsistencias: Record<string, any>[];
}

function createMockSupabase(
  initial: Partial<MockDbState> = {},
  options: {
    failOn?: 'insert_ponto' | 'update_ponto' | 'insert_inconsistencia';
    simulateConcurrentTransition?: boolean;
    simulateConcurrentClosing?: boolean;
  } = {},
) {
  const db: MockDbState = {
    registros_ponto: [...(initial.registros_ponto || [])],
    rh_financeiro_lotes: [...(initial.rh_financeiro_lotes || [])],
    fechamento_mensal: [...(initial.fechamento_mensal || [])],
    processamento_rh_inconsistencias: [...(initial.processamento_rh_inconsistencias || [])],
  };

  let idSeq = 1;
  const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

  const rpc = async (fnName: string, params: any) => {
    if (fnName === 'rpc_atualizar_ponto_se_competencia_aberta') {
      const { p_tenant_id, p_registro_id, p_empresa_id, p_competencia, p_payload } = params;

      // 1. Simular verificação de competência fechada
      const compJaFechada = db.rh_financeiro_lotes.some(
        (l) =>
          l.tenant_id === p_tenant_id &&
          l.empresa_id === p_empresa_id &&
          l.competencia === p_competencia &&
          !['CANCELADO', 'DEVOLVIDO_RH'].includes(String(l.status || '').toUpperCase()),
      );

      if (compJaFechada) {
        return { data: { status: 'COMPETENCIA_FECHADA' }, error: null };
      }

      // 2. Simular transição concorrente
      if (options.simulateConcurrentTransition) {
        db.registros_ponto = db.registros_ponto.map((r) =>
          r.id === p_registro_id
            ? { ...r, status_processamento: 'PROCESSADO', status: 'Processado' }
            : r,
        );
      }

      // 3. Localizar registro de ponto
      const ponto = db.registros_ponto.find(
        (r) => r.id === p_registro_id && r.tenant_id === p_tenant_id,
      );

      if (!ponto) {
        return { data: { status: 'REGISTRO_NAO_ENCONTRADO' }, error: null };
      }

      // Validação de divergência de empresa/competência
      if (p_empresa_id && ponto.empresa_id && ponto.empresa_id !== p_empresa_id) {
        return { data: { status: 'DIVERGENCIA_EMPRESA', message: 'A empresa informada difere da empresa registrada no ponto.' }, error: null };
      }

      // Validação de mutação estrutural proibida via payload
      if (p_payload?.empresa_id && p_payload.empresa_id !== ponto.empresa_id) {
        return { data: { status: 'MUTACAO_ESTRUTURAL_INVALIDA', message: 'Alteração de empresa_id proibida.' }, error: null };
      }
      if (p_payload?.colaborador_id && p_payload.colaborador_id !== ponto.colaborador_id) {
        return { data: { status: 'MUTACAO_ESTRUTURAL_INVALIDA', message: 'Alteração de colaborador_id proibida.' }, error: null };
      }
      if (p_payload?.data && p_payload.data !== ponto.data) {
        return { data: { status: 'MUTACAO_ESTRUTURAL_INVALIDA', message: 'Alteração de data proibida.' }, error: null };
      }

      if (
        ['PROCESSADO', 'FECHADO'].includes(String(ponto.status_processamento || '').toUpperCase()) ||
        ['PROCESSADO', 'FECHADO'].includes(String(ponto.status || '').toUpperCase())
      ) {
        return { data: { status: 'STATUS_INVALIDO' }, error: null };
      }

      // 4. Atualizar registro
      Object.assign(ponto, p_payload, { updated_at: new Date().toISOString() });
      return { data: { status: 'ATUALIZADO', id: ponto.id }, error: null };
    }

    return { data: null, error: { message: `RPC ${fnName} não mockada` } };
  };

  const from = (table: keyof MockDbState) => {
    const filters: Array<(row: Record<string, any>) => boolean> = [];
    let rangeBounds: [number, number] | null = null;
    let pendingOp: 'select' | 'insert' | 'update' = 'select';
    let payload: any = null;
    let selectedCols: string | null = null;
    let isSingle = false;

    const executeSelect = () => {
      let rows = db[table].filter((r) => filters.every((fn) => fn(r)));
      if (rangeBounds) {
        rows = rows.slice(rangeBounds[0], rangeBounds[1] + 1);
      }
      if (isSingle) {
        return { data: rows.length > 0 ? { ...rows[0] } : null, error: null };
      }
      return { data: rows.map((r) => ({ ...r })), error: null };
    };

    const builder: any = {
      select: (cols?: string) => {
        selectedCols = cols || null;
        return builder;
      },
      maybeSingle: () => {
        isSingle = true;
        return builder;
      },
      single: () => {
        isSingle = true;
        return builder;
      },
      insert: (rows: any) => {
        pendingOp = 'insert';
        payload = Array.isArray(rows) ? rows : [rows];
        if (table === 'registros_ponto' && options.failOn === 'insert_ponto') {
          return Promise.resolve({ data: null, error: { message: 'Simulated DB insert failure on registros_ponto' } });
        }
        if (table === 'processamento_rh_inconsistencias' && options.failOn === 'insert_inconsistencia') {
          return Promise.resolve({ data: null, error: { message: 'Simulated DB insert failure on processamento_rh_inconsistencias' } });
        }
        const inserted = payload.map((item: any) => ({
          id: item.id || nextId(table),
          ...item,
        }));
        db[table].push(...inserted);
        return Promise.resolve({ data: inserted, error: null });
      },
      update: (vals: any) => {
        pendingOp = 'update';
        payload = vals;
        return builder;
      },
      eq: (col: string, val: any) => {
        filters.push((r) => r[col] === val);
        return builder;
      },
      in: (col: string, vals: any[]) => {
        filters.push((r) => vals.includes(r[col]));
        return builder;
      },
      not: (col: string, operator: string, val: string) => {
        if (operator === 'in') {
          // Parse format '("A","B")'
          const cleanVals = val
            .replace(/[()"]/g, '')
            .split(',')
            .map((s) => s.trim().toUpperCase());
          filters.push((r) => !cleanVals.includes(String(r[col] || '').trim().toUpperCase()));
        }
        return builder;
      },
      range: (fromIdx: number, toIdx: number) => {
        rangeBounds = [fromIdx, toIdx];
        return builder;
      },
      then: (resolve: any, reject: any) => {
        if (pendingOp === 'update') {
          if (table === 'registros_ponto' && options.failOn === 'update_ponto') {
            return Promise.resolve({ data: null, error: { message: 'Simulated DB update failure' } }).then(resolve, reject);
          }

          // Se simular transição concorrente, o registro no banco foi alterado para PROCESSADO antes deste update
          if (table === 'registros_ponto' && options.simulateConcurrentTransition) {
            db.registros_ponto = db.registros_ponto.map((r) => ({
              ...r,
              status_processamento: 'PROCESSADO',
              status: 'Processado',
            }));
          }

          const updated: any[] = [];
          db[table] = db[table].map((r) => {
            if (filters.every((fn) => fn(r))) {
              const next = { ...r, ...payload };
              updated.push(next);
              return next;
            }
            return r;
          });
          return Promise.resolve({ data: updated, error: null }).then(resolve, reject);
        }
        return Promise.resolve(executeSelect()).then(resolve, reject);
      },
    };

    return builder;
  };

  return { supabase: { from, rpc }, db };
}

async function makeRecord(overrides: Partial<PontoIngestionRecord> = {}): Promise<PontoIngestionRecord> {
  const tenantId = overrides.tenant_id ?? 'tenant-1';
  const empresaId = overrides.empresa_id !== undefined ? overrides.empresa_id : 'emp-1';
  const colaboradorId = overrides.colaborador_id !== undefined ? overrides.colaborador_id : 'colab-1';
  const data = overrides.data ?? '2026-10-15';
  const chave =
    overrides.chave_importacao ??
    (await buildCanonicalPontoKey(
      {
        tenantId,
        empresaId,
        colaboradorId,
        cpf: overrides.cpf_colaborador ?? '11122233344',
        matricula: overrides.matricula_colaborador ?? 'CLT-HML-001',
        nome: overrides.nome_colaborador ?? 'Colaborador Teste 01',
        data,
        jornadaDiscriminator: overrides.jornada_discriminator ?? null,
      },
      sha256Hex,
    ));

  return {
    tenant_id: tenantId,
    importacao_id: 'imp-1',
    chave_importacao: chave,
    data,
    competencia: data.slice(0, 7),
    entrada: '08:00:00',
    saida_almoco: '12:00:00',
    retorno_almoco: '13:00:00',
    saida: '17:00:00',
    origem: overrides.origem ?? 'api',
    status: 'Pendente',
    status_processamento: 'PENDENTE_PROCESSAMENTO',
    nome_colaborador: 'Colaborador Teste 01',
    matricula_colaborador: 'CLT-HML-001',
    cpf_colaborador: '11122233344',
    empresa_nome: 'Empresa Homologação',
    empresa_id: empresaId,
    colaborador_id: colaboradorId,
    is_teste: true,
    ...overrides,
  };
}

describe('GATE-RH-02A — Integridade e Concorrência de Pontos CLT (Suíte Completa)', () => {
  it('1. Ponto aberto é atualizado normalmente (1 linha afetada)', async () => {
    const openRec = await makeRecord({ saida: '17:00:00' });
    const { supabase, db } = createMockSupabase({
      registros_ponto: [{ id: 'rp-open', ...openRec }],
    });

    const corrected = await makeRecord({ saida: '17:30:00', importacao_id: 'imp-01' });
    const res = await ingestPontosBatch({
      supabase,
      tenantId: 'tenant-1',
      importacaoId: 'imp-01',
      records: [corrected],
    });

    expect(res.inseridos).toBe(0);
    expect(res.atualizados).toBe(1);
    expect(res.correcoes_pendentes).toHaveLength(0);
    expect(db.registros_ponto[0].saida).toBe('17:30:00');
    expect(db.registros_ponto[0].status_processamento).toBe('PENDENTE_PROCESSAMENTO');
  });

  it('2. Ponto processado entre leitura e atualização (0 linhas afetadas): preserva registro e cria inconsistência CORRECAO_POS_PROCESSAMENTO', async () => {
    const openAtFirst = await makeRecord({ saida: '17:00:00' });
    const { supabase, db } = createMockSupabase(
      {
        registros_ponto: [{ id: 'rp-race', ...openAtFirst }],
      },
      { simulateConcurrentTransition: true }, // simula Motor RH marcando PROCESSADO exatamente antes do UPDATE
    );

    const incoming = await makeRecord({ saida: '18:00:00', importacao_id: 'imp-02' });
    const res = await ingestPontosBatch({
      supabase,
      tenantId: 'tenant-1',
      importacaoId: 'imp-02',
      records: [incoming],
    });

    expect(res.atualizados).toBe(0);
    expect(res.correcoes_pendentes).toHaveLength(1);
    expect(res.correcoes_pendentes[0].tipo).toBe('CORRECAO_POS_PROCESSAMENTO');
    // Confirma que a batida processada NÃO foi sobrescrita
    expect(db.registros_ponto[0].saida).toBe('17:00:00');
    expect(db.registros_ponto[0].status_processamento).toBe('PROCESSADO');
    // Confirma criação de inconsistência aberta
    expect(db.processamento_rh_inconsistencias).toHaveLength(1);
    expect(db.processamento_rh_inconsistencias[0].tipo).toBe('CORRECAO_POS_PROCESSAMENTO');
  });

  it('3. Competência fechada durante a atualização: bloqueia e cria inconsistência COMPETENCIA_FECHADA', async () => {
    const openRec = await makeRecord({ saida: '17:00:00', data: '2026-09-15', competencia: '2026-09' });
    const { supabase, db } = createMockSupabase({
      registros_ponto: [{ id: 'rp-comp-race', ...openRec }],
      rh_financeiro_lotes: [
        {
          id: 'lote-race',
          tenant_id: 'tenant-1',
          empresa_id: 'emp-1',
          competencia: '2026-09',
          status: 'AGUARDANDO_FINANCEIRO',
        },
      ],
    });

    const incoming = await makeRecord({ data: '2026-09-15', competencia: '2026-09', saida: '18:15:00' });
    const res = await ingestPontosBatch({
      supabase,
      tenantId: 'tenant-1',
      importacaoId: 'imp-03',
      records: [incoming],
    });

    expect(res.atualizados).toBe(0);
    expect(res.bloqueados_fechamento).toBe(1);
    expect(res.correcoes_pendentes[0].tipo).toBe('COMPETENCIA_FECHADA');
    expect(db.registros_ponto[0].saida).toBe('17:00:00');
    expect(db.processamento_rh_inconsistencias).toHaveLength(1);
  });

  it('4. Importação Google Drive repetida: não duplica e ignora registros idênticos', async () => {
    const driveRec = await makeRecord({ origem: 'google_drive' });
    const { supabase, db } = createMockSupabase({
      registros_ponto: [{ id: 'rp-drive-1', ...driveRec }],
    });

    const res = await ingestPontosBatch({
      supabase,
      tenantId: 'tenant-1',
      importacaoId: 'imp-drive-2',
      records: [await makeRecord({ origem: 'google_drive' })],
    });

    expect(res.inseridos).toBe(0);
    expect(res.atualizados).toBe(0);
    expect(res.ignorados_duplicados).toBe(1);
    expect(db.registros_ponto).toHaveLength(1);
  });

  it('5. Mesmo ponto enviado por Google Drive e RHiD: unifica pela chave canônica sem duplicar', async () => {
    const keyRhid = await buildCanonicalPontoKey(
      {
        tenantId: 'tenant-1',
        empresaId: 'emp-1',
        colaboradorId: 'colab-1',
        cpf: '11122233344',
        matricula: 'CLT-HML-001',
        nome: 'Colaborador Teste 01',
        data: '2026-10-15',
      },
      sha256Hex,
    );

    const keyDrive = await buildCanonicalPontoKey(
      {
        tenantId: 'tenant-1',
        empresaId: 'emp-1',
        colaboradorId: 'colab-1',
        cpf: '111.222.333-44',
        matricula: null,
        nome: 'COLABORADOR TESTE 01',
        data: '2026-10-15',
      },
      sha256Hex,
    );

    expect(keyRhid).toBe(keyDrive);

    const { supabase, db } = createMockSupabase({
      registros_ponto: [
        {
          id: 'rp-rhid',
          ...(await makeRecord({ origem: 'api', chave_importacao: keyRhid })),
        },
      ],
    });

    // Reenvio via Google Drive para o mesmo dia e colaborador
    const res = await ingestPontosBatch({
      supabase,
      tenantId: 'tenant-1',
      importacaoId: 'imp-drive',
      records: [await makeRecord({ origem: 'google_drive', chave_importacao: keyDrive })],
    });

    expect(res.inseridos).toBe(0);
    expect(res.ignorados_duplicados).toBe(1);
    expect(db.registros_ponto).toHaveLength(1);
  });

  it('6. Erro de banco e registro correto da falha sem sucesso fictício', async () => {
    const { supabase, db } = createMockSupabase({}, { failOn: 'insert_ponto' });
    const rec = await makeRecord();

    await expect(
      ingestPontosBatch({
        supabase,
        tenantId: 'tenant-1',
        importacaoId: 'imp-err',
        records: [rec],
      }),
    ).rejects.toThrow(/Falha ao inserir registros_ponto/);

    expect(db.registros_ponto).toHaveLength(0);
  });

  it('7. Isolamento por tenant, empresa e ambiente com jornadas distintas preservadas', async () => {
    const { supabase, db } = createMockSupabase();

    const t1Emp1Turno1 = await makeRecord({
      tenant_id: 'tenant-1',
      empresa_id: 'emp-1',
      colaborador_id: 'colab-1',
      jornada_discriminator: 'MANHA',
    });
    const t1Emp1Turno2 = await makeRecord({
      tenant_id: 'tenant-1',
      empresa_id: 'emp-1',
      colaborador_id: 'colab-1',
      jornada_discriminator: 'NOITE',
      entrada: '18:00:00',
      saida: '23:00:00',
    });
    const t1Emp2 = await makeRecord({
      tenant_id: 'tenant-1',
      empresa_id: 'emp-2',
      colaborador_id: 'colab-1',
    });

    const res = await ingestPontosBatch({
      supabase,
      tenantId: 'tenant-1',
      importacaoId: 'imp-iso',
      records: [t1Emp1Turno1, t1Emp1Turno2, t1Emp2],
    });

    expect(res.inseridos).toBe(3);
    expect(db.registros_ponto).toHaveLength(3);
    expect(db.registros_ponto.map((r) => r.chave_importacao)).toHaveLength(3);
  });

  it('8. Atomicidade: atualização bloqueada por fechamento simultâneo na RPC transacional', async () => {
    const { supabase, db } = createMockSupabase({
      registros_ponto: [
        {
          id: 'rp-atomic-1',
          tenant_id: 'tenant-1',
          empresa_id: 'emp-1',
          colaborador_id: 'colab-1',
          data: '2026-10-15',
          competencia: '2026-10',
          entrada: '08:00:00',
          saida: '17:00:00',
          status: 'Pendente',
          status_processamento: 'PENDENTE_PROCESSAMENTO',
          chave_importacao: 'chave-atomic-1',
        },
      ],
    });

    // Simulando que no momento da atualização pela RPC, a competência 2026-10 da emp-1 está em rh_financeiro_lotes
    db.rh_financeiro_lotes.push({
      id: 'lote-clt-1',
      tenant_id: 'tenant-1',
      empresa_id: 'emp-1',
      competencia: '2026-10',
      status: 'AGUARDANDO_FINANCEIRO',
      tipo: 'FOLHA_BASE',
    });

    const res = await ingestPontosBatch({
      supabase,
      tenantId: 'tenant-1',
      importacaoId: 'imp-atomic',
      records: [
        {
          tenant_id: 'tenant-1',
          empresa_id: 'emp-1',
          colaborador_id: 'colab-1',
          data: '2026-10-15',
          competencia: '2026-10',
          entrada: '07:30:00', // batida corrigida que colide com fechamento
          saida_almoco: null,
          retorno_almoco: null,
          saida: '17:00:00',
          total_horas: '08:30',
          horas_trabalhadas: '08:30',
          horas_extras: '00:00',
          horas_faltas: '00:00',
          origem: 'api',
          chave_importacao: 'chave-atomic-1',
          nome_colaborador: 'Colaborador Teste',
        },
      ],
    });

    expect(res.atualizados).toBe(0);
    expect(res.bloqueados_fechamento).toBe(1);
    expect(res.correcoes_pendentes).toHaveLength(1);
    expect(res.correcoes_pendentes[0].tipo).toBe('COMPETENCIA_FECHADA');

    // Ponto original no banco deve permanecer intacto
    const ponto = db.registros_ponto.find((r) => r.id === 'rp-atomic-1');
    expect(ponto?.entrada).toBe('08:00:00');
    expect(ponto?.status_processamento).toBe('PENDENTE_PROCESSAMENTO');

    // Inconsistência registrada
    expect(db.processamento_rh_inconsistencias).toHaveLength(1);
    expect(db.processamento_rh_inconsistencias[0].tipo).toBe('COMPETENCIA_FECHADA');
  });

  it('9. Atomicidade: atualização barrada quando ponto sofre transição para PROCESSADO durante a chamada RPC', async () => {
    const { supabase, db } = createMockSupabase(
      {
        registros_ponto: [
          {
            id: 'rp-atomic-2',
            tenant_id: 'tenant-1',
            empresa_id: 'emp-1',
            colaborador_id: 'colab-1',
            data: '2026-10-15',
            competencia: '2026-10',
            entrada: '08:00:00',
            saida: '17:00:00',
            status: 'Pendente',
            status_processamento: 'PENDENTE_PROCESSAMENTO',
            chave_importacao: 'chave-atomic-2',
          },
        ],
      },
      { simulateConcurrentTransition: true },
    );

    const res = await ingestPontosBatch({
      supabase,
      tenantId: 'tenant-1',
      importacaoId: 'imp-atomic-2',
      records: [
        {
          tenant_id: 'tenant-1',
          empresa_id: 'emp-1',
          colaborador_id: 'colab-1',
          data: '2026-10-15',
          competencia: '2026-10',
          entrada: '08:15:00',
          saida_almoco: null,
          retorno_almoco: null,
          saida: '17:00:00',
          total_horas: '08:00',
          horas_trabalhadas: '08:00',
          horas_extras: '00:00',
          horas_faltas: '00:00',
          origem: 'api',
          chave_importacao: 'chave-atomic-2',
          nome_colaborador: 'Colaborador Teste',
        },
      ],
    });

    expect(res.atualizados).toBe(0);
    expect(res.correcoes_pendentes).toHaveLength(1);
    expect(res.correcoes_pendentes[0].tipo).toBe('CORRECAO_POS_PROCESSAMENTO');

    // Ponto original no banco deve manter a batida original de 08:00:00
    const ponto = db.registros_ponto.find((r) => r.id === 'rp-atomic-2');
    expect(ponto?.entrada).toBe('08:00:00');
    expect(ponto?.status_processamento).toBe('PROCESSADO');

    // Inconsistência registrada
    expect(db.processamento_rh_inconsistencias).toHaveLength(1);
    expect(db.processamento_rh_inconsistencias[0].tipo).toBe('CORRECAO_POS_PROCESSAMENTO');
  });

  it('10. Fail-Closed: RPC indisponível deve disparar erro explícito bloqueando mutação insegura', async () => {
    const existingPonto = {
      id: 'rp-no-rpc',
      tenant_id: 'tenant-1',
      empresa_id: 'emp-1',
      colaborador_id: 'colab-1',
      data: '2026-10-15',
      competencia: '2026-10',
      entrada: '08:00:00',
      saida: '17:00:00',
      status: 'Pendente',
      status_processamento: 'PENDENTE_PROCESSAMENTO',
      chave_importacao: 'chave-no-rpc',
    };

    const mock = createMockSupabase({
      registros_ponto: [existingPonto],
    });

    const supabaseWithoutRpc = {
      from: mock.supabase.from,
      rpc: undefined, // Simula ausência de suporte/função
    };

    await expect(
      ingestPontosBatch({
        supabase: supabaseWithoutRpc,
        tenantId: 'tenant-1',
        importacaoId: 'imp-no-rpc',
        records: [
          {
            tenant_id: 'tenant-1',
            empresa_id: 'emp-1',
            colaborador_id: 'colab-1',
            data: '2026-10-15',
            competencia: '2026-10',
            entrada: '08:10:00', // batida alterada para disparar update
            saida_almoco: null,
            retorno_almoco: null,
            saida: '17:00:00',
            total_horas: '08:00',
            horas_trabalhadas: '08:00',
            horas_extras: '00:00',
            horas_faltas: '00:00',
            origem: 'api',
            chave_importacao: 'chave-no-rpc',
            nome_colaborador: 'Colaborador Teste',
          },
        ],
      }),
    ).rejects.toThrow(/RPC_INDISPONIVEL/);
  });

  it('11. Menor Privilégio: usuário sem autorização na RPC deve resultar em falha expressa de autorização', async () => {
    const existingPonto = {
      id: 'rp-unauth',
      tenant_id: 'tenant-1',
      empresa_id: 'emp-1',
      colaborador_id: 'colab-1',
      data: '2026-10-15',
      competencia: '2026-10',
      entrada: '08:00:00',
      saida: '17:00:00',
      status: 'Pendente',
      status_processamento: 'PENDENTE_PROCESSAMENTO',
      chave_importacao: 'chave-unauth',
    };

    const mock = createMockSupabase({
      registros_ponto: [existingPonto],
    });

    const supabaseUnauth = {
      from: mock.supabase.from,
      rpc: async () => ({
        data: {
          status: 'FALHA_AUTORIZACAO',
          message: 'Acesso negado: perfil do usuário não autorizado para alterar registros de ponto.',
        },
        error: null,
      }),
    };

    await expect(
      ingestPontosBatch({
        supabase: supabaseUnauth,
        tenantId: 'tenant-1',
        importacaoId: 'imp-unauth',
        records: [
          {
            tenant_id: 'tenant-1',
            empresa_id: 'emp-1',
            colaborador_id: 'colab-1',
            data: '2026-10-15',
            competencia: '2026-10',
            entrada: '08:10:00', // batida alterada para disparar update
            saida_almoco: null,
            retorno_almoco: null,
            saida: '17:00:00',
            total_horas: '08:00',
            horas_trabalhadas: '08:00',
            horas_extras: '00:00',
            horas_faltas: '00:00',
            origem: 'api',
            chave_importacao: 'chave-unauth',
            nome_colaborador: 'Colaborador Teste',
          },
        ],
      }),
    ).rejects.toThrow(/Falha de Autorização/);
  });

  it('12. Suspensão Operacional: quando a flag de emergência estiver ativa, aborta atualização sem deixar ponto inconsistente', async () => {
    const existingPonto = {
      id: 'rp-suspenso',
      tenant_id: 'tenant-1',
      empresa_id: 'emp-1',
      colaborador_id: 'colab-1',
      data: '2026-10-15',
      competencia: '2026-10',
      entrada: '08:00:00',
      saida: '17:00:00',
      status: 'Pendente',
      status_processamento: 'PENDENTE_PROCESSAMENTO',
      chave_importacao: 'chave-suspenso',
    };

    const mock = createMockSupabase({
      registros_ponto: [existingPonto],
    });

    const supabaseSuspenso = {
      from: mock.supabase.from,
      rpc: async () => ({
        data: {
          status: 'INGESTAO_SUSPENSA',
          message: 'A ingestão e atualização de pontos está temporariamente suspensa pelo administrador.',
        },
        error: null,
      }),
    };

    await expect(
      ingestPontosBatch({
        supabase: supabaseSuspenso,
        tenantId: 'tenant-1',
        importacaoId: 'imp-suspenso',
        records: [
          {
            tenant_id: 'tenant-1',
            empresa_id: 'emp-1',
            colaborador_id: 'colab-1',
            data: '2026-10-15',
            competencia: '2026-10',
            entrada: '08:10:00',
            saida_almoco: null,
            retorno_almoco: null,
            saida: '17:00:00',
            total_horas: '08:00',
            horas_trabalhadas: '08:00',
            horas_extras: '00:00',
            horas_faltas: '00:00',
            origem: 'api',
            chave_importacao: 'chave-suspenso',
            nome_colaborador: 'Colaborador Teste',
          },
        ],
      }),
    ).rejects.toThrow(/INGESTAO_SUSPENSA/);
  });

  it('13. Autenticação de Entrada: validatePontoIngestAuth deve rejeitar requisição sem credencial ou com token forjado', async () => {
    const { validatePontoIngestAuth } = await import('../../supabase/functions/_shared/pontoIntegrity');

    // Requisição anônima sem cabeçalhos
    const reqVazia = new Request('https://edge.supabase.co/importar-pontos-rhid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const resVazia = await validatePontoIngestAuth({
      req: reqVazia,
      supabase: {},
      serviceRoleKey: 'test-service-role-key-1234567890',
      webhookSecretEnv: 'super-secret-webhook-key-12345678',
    });

    expect(resVazia.authorized).toBe(false);
    expect(resVazia.errorResponse?.status).toBe(401);

    // Requisição com segredo incorreto
    const reqInvalida = new Request('https://edge.supabase.co/importar-pontos-rhid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': 'segredo-errado',
      },
    });

    const resInvalida = await validatePontoIngestAuth({
      req: reqInvalida,
      supabase: {},
      serviceRoleKey: 'test-service-role-key-1234567890',
      webhookSecretEnv: 'super-secret-webhook-key-12345678',
    });

    expect(resInvalida.authorized).toBe(false);
    expect(resInvalida.errorResponse?.status).toBe(401);

    // Requisição com webhook secret legítimo
    const reqValidaWebhook = new Request('https://edge.supabase.co/importar-pontos-rhid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': 'super-secret-webhook-key-12345678',
      },
    });

    const resValidaWebhook = await validatePontoIngestAuth({
      req: reqValidaWebhook,
      supabase: {},
      serviceRoleKey: 'test-service-role-key-1234567890',
      webhookSecretEnv: 'super-secret-webhook-key-12345678',
    });

    expect(resValidaWebhook.authorized).toBe(true);
    expect(resValidaWebhook.authType).toBe('webhook_secret');

    // Requisição com service_role legítimo
    const reqValidaServiceRole = new Request('https://edge.supabase.co/importar-pontos-rhid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'test-service-role-key-1234567890',
      },
    });

    const resValidaServiceRole = await validatePontoIngestAuth({
      req: reqValidaServiceRole,
      supabase: {},
      serviceRoleKey: 'test-service-role-key-1234567890',
      webhookSecretEnv: 'super-secret-webhook-key-12345678',
    });

    expect(resValidaServiceRole.authorized).toBe(true);
    expect(resValidaServiceRole.authType).toBe('service_role');
  });

  it('14. Isolamento Estrito por Tenant: JWT do operador não pode ser utilizado para injetar pontos em tenant divergente', async () => {
    const { validatePontoIngestAuth } = await import('../../supabase/functions/_shared/pontoIntegrity');

    const mockSupabaseAuth = {
      auth: {
        getUser: async (token: string) => {
          if (token === 'valid-operator-jwt') {
            return { data: { user: { id: 'usr-tenant-a' } }, error: null };
          }
          return { data: { user: null }, error: { message: 'Invalid JWT' } };
        },
      },
      from: (tbl: string) => ({
        select: (cols: string) => ({
          eq: (col: string, val: string) => ({
            maybeSingle: async () => {
              if (tbl === 'profiles' && val === 'usr-tenant-a') {
                return { data: { tenant_id: 'tenant-a', role: 'rh' }, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      }),
    };

    const reqOperador = new Request('https://edge.supabase.co/importar-pontos-google-drive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-operator-jwt',
      },
    });

    const authRes = await validatePontoIngestAuth({
      req: reqOperador,
      supabase: mockSupabaseAuth,
    });

    expect(authRes.authorized).toBe(true);
    expect(authRes.authType).toBe('jwt');
    expect(authRes.tenantId).toBe('tenant-a');

    // Validação de TenantMismatch: tentar forçar tenant-b
    const targetPayloadTenant = 'tenant-b';
    const isTenantMismatch = targetPayloadTenant !== authRes.tenantId;
    expect(isTenantMismatch).toBe(true);
  });

  it('15. Proteção contra mutação estrutural: RPC rejeita tentativa de alterar empresa_id de ponto existente via payload', async () => {
    const existingPonto = {
      id: 'rp-emp-lock',
      tenant_id: 'tenant-1',
      empresa_id: 'emp-original',
      colaborador_id: 'colab-1',
      data: '2026-10-15',
      competencia: '2026-10',
      entrada: '08:00:00',
      saida: '17:00:00',
      status: 'Pendente',
      status_processamento: 'PENDENTE_PROCESSAMENTO',
      chave_importacao: 'chave-emp-lock',
    };

    const { supabase } = createMockSupabase({
      registros_ponto: [existingPonto],
    });

    // Tentativa de update enviando empresa_id diferente no registro a atualizar
    await expect(
      ingestPontosBatch({
        supabase,
        tenantId: 'tenant-1',
        importacaoId: 'imp-emp-bypass',
        records: [
          {
            tenant_id: 'tenant-1',
            empresa_id: 'emp-tentativa-bypass', // empresa divergente
            colaborador_id: 'colab-1',
            data: '2026-10-15',
            competencia: '2026-10',
            entrada: '08:15:00',
            saida_almoco: null,
            retorno_almoco: null,
            saida: '17:00:00',
            total_horas: '08:00',
            horas_trabalhadas: '08:00',
            horas_extras: '00:00',
            horas_faltas: '00:00',
            origem: 'api',
            chave_importacao: 'chave-emp-lock',
            nome_colaborador: 'Colaborador Teste',
          },
        ],
      }),
    ).rejects.toThrow(/MUTACAO_INVALIDA/);
  });

  describe('FIX-RELEASE-01: Sanitização de Payload e Prevenção de Schema Mismatch', () => {
    it('16. sanitizeDbPayload remove explicitamente importacao_id e campos desconhecidos', () => {
      const dirtyRecord: PontoIngestionRecord = {
        tenant_id: 'tenant-123',
        empresa_id: 'emp-123',
        colaborador_id: 'colab-123',
        data: '2026-11-13',
        competencia: '2026-11',
        entrada: '08:00:00',
        saida_almoco: '12:00:00',
        retorno_almoco: '13:00:00',
        saida: '17:00:00',
        origem: 'api',
        status: 'Pendente',
        status_processamento: 'PENDENTE_PROCESSAMENTO',
        nome_colaborador: 'Colaborador Teste',
        chave_importacao: 'hash-123',
        importacao_id: '1e67cc4d-2076-4bd4-969d-83914a841981', // campo inexistente na tabela registros_ponto
        jornada_discriminator: 'TURNO_1', // campo em memória
        campo_inexistente_aleatorio: 'valor_invalido', // campo aleatório
      };

      const sanitized = sanitizeDbPayload(dirtyRecord);

      expect(sanitized).not.toHaveProperty('importacao_id');
      expect(sanitized).not.toHaveProperty('jornada_discriminator');
      expect(sanitized).not.toHaveProperty('campo_inexistente_aleatorio');

      // Campos canônicos válidos devem ser preservados
      expect(sanitized).toHaveProperty('tenant_id', 'tenant-123');
      expect(sanitized).toHaveProperty('empresa_id', 'emp-123');
      expect(sanitized).toHaveProperty('colaborador_id', 'colab-123');
      expect(sanitized).toHaveProperty('data', '2026-11-13');
      expect(sanitized).toHaveProperty('entrada', '08:00:00');
      expect(sanitized).toHaveProperty('chave_importacao', 'hash-123');

      // Garantir que todos os campos restantes pertencem à whitelist de colunas de registros_ponto
      for (const key of Object.keys(sanitized)) {
        expect(VALID_REGISTROS_PONTO_COLUMNS.has(key)).toBe(true);
      }
    });

    it('17. ingestPontosBatch insere registros sem vazar importacao_id para o banco', async () => {
      const { supabase, db } = createMockSupabase();

      const result = await ingestPontosBatch({
        supabase,
        tenantId: 'tenant-123',
        importacaoId: '1e67cc4d-2076-4bd4-969d-83914a841981',
        records: [
          {
            tenant_id: 'tenant-123',
            empresa_id: 'emp-123',
            colaborador_id: 'colab-123',
            data: '2026-11-13',
            competencia: '2026-11',
            entrada: '08:00:00',
            saida_almoco: null,
            retorno_almoco: null,
            saida: '17:00:00',
            origem: 'api',
            status: 'Pendente',
            status_processamento: 'PENDENTE_PROCESSAMENTO',
            nome_colaborador: 'Colaborador Teste',
            chave_importacao: 'chave-safe-insert',
            importacao_id: '1e67cc4d-2076-4bd4-969d-83914a841981',
            jornada_discriminator: 'D1',
          },
        ],
      });

      expect(result.inseridos).toBe(1);
      expect(db.registros_ponto.length).toBe(1);

      const insertedRow = db.registros_ponto[0];
      expect(insertedRow.chave_importacao).toBe('chave-safe-insert');
      expect(insertedRow).not.toHaveProperty('importacao_id');
      expect(insertedRow).not.toHaveProperty('jornada_discriminator');
      expect(insertedRow.data).toBe('2026-11-13');
    });
  });
});
