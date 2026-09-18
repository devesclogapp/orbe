import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Fase 1 - Contrato de Banco, Segurança e RPC para Custos Extras (TO-BE)', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../../supabase/migrations/20260918130000_fase1_custos_extras_origem_recurso_rpc.sql'
  );

  it('deve existir o arquivo de migration da Fase 1', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

  describe('Auditoria Estática de Segurança e Constraints no SQL', () => {
    it('NÃO deve utilizar DEFAULT PAGO_EMPRESA no schema do banco', () => {
      expect(sqlContent).not.toMatch(/DEFAULT\s+['"]PAGO_EMPRESA['"]/i);
      expect(sqlContent).toContain('ALTER COLUMN origem_recurso SET NOT NULL');
    });

    it('deve garantir backfill explícito para LEGACY antes de aplicar NOT NULL', () => {
      const legacyUpdateIdx = sqlContent.indexOf("SET origem_recurso = 'LEGACY'");
      const notNullIdx = sqlContent.indexOf('ALTER COLUMN origem_recurso SET NOT NULL');
      expect(legacyUpdateIdx).toBeGreaterThan(-1);
      expect(notNullIdx).toBeGreaterThan(-1);
      expect(legacyUpdateIdx).toBeLessThan(notNullIdx);
    });

    it('deve conter constraint com os 4 domínios canônicos de origem_recurso', () => {
      expect(sqlContent).toContain(
        "CHECK (origem_recurso IN ('PAGO_EMPRESA', 'REEMBOLSO_COLABORADOR', 'PAGAMENTO_PENDENTE', 'LEGACY'))"
      );
    });

    it('NÃO deve adicionar LIQUIDADO a status_pagamento', () => {
      expect(sqlContent).not.toContain("'LIQUIDADO'");
      expect(sqlContent).not.toContain('"LIQUIDADO"');
    });

    it('deve referenciar corretamente as FKs de colaboradores e fornecedores', () => {
      expect(sqlContent).toContain(
        'favorecido_colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL'
      );
      expect(sqlContent).toContain(
        'favorecido_fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL'
      );
    });

    it('deve conter validação de autenticação estrita (AUTH_REQUIRED)', () => {
      expect(sqlContent).toContain('AUTH_REQUIRED: Operação restrita a usuários autenticados.');
    });

    it('deve conter lookup de tenant e perfil em profiles com fallback seguro', () => {
      expect(sqlContent).toContain('FROM public.profiles');
      expect(sqlContent).toContain('public.current_tenant_id()');
      expect(sqlContent).toContain('TENANT_REQUIRED');
      expect(sqlContent).toContain('ROLE_NOT_AUTHORIZED');
    });

    it('deve conter isolamento estrito multi-tenant (TENANT_MISMATCH)', () => {
      expect(sqlContent).toContain('TENANT_MISMATCH: Acesso negado. O registro de custo extra pertence a outro tenant.');
    });

    it('deve conter verificação de registro inexistente com lock FOR UPDATE', () => {
      expect(sqlContent).toContain('FOR UPDATE');
      expect(sqlContent).toContain('REGISTRO_NOT_FOUND');
    });

    it('deve bloquear devolução quando status_pagamento for PAGO', () => {
      expect(sqlContent).toContain("v_registro.status_pagamento = 'PAGO'");
      expect(sqlContent).toContain('Requer estorno/reabertura financeira específica.');
    });

    it('deve bloquear devolução quando pipeline_status for FINALIZADO', () => {
      expect(sqlContent).toContain("v_registro.pipeline_status = 'FINALIZADO'");
      expect(sqlContent).toContain('Estado FINALIZADO é terminal e não permite devolução pela ação padrão.');
    });

    it('deve bloquear enviar_financeiro fail-closed se não for REEMBOLSO, PENDENTE ou LEGACY', () => {
      expect(sqlContent).toContain("origem_recurso NOT IN ('REEMBOLSO_COLABORADOR', 'PAGAMENTO_PENDENTE', 'LEGACY')");
    });

    it('deve conter fail-closed em aprovar com ELSIF LEGACY e ELSE lançando ORIGEM_RECURSO_INVALIDA', () => {
      expect(sqlContent).toContain("ELSIF v_registro.origem_recurso = 'LEGACY' THEN");
      expect(sqlContent).toContain("RAISE EXCEPTION 'ORIGEM_RECURSO_INVALIDA: Origem de recurso (%) não reconhecida para aprovação.'");
    });

    it('deve usar justificativa_devolucao no UPDATE da RPC e preservar p_justificativa na assinatura pública', () => {
      // 1. Preserva o nome do parâmetro público da RPC como p_justificativa
      expect(sqlContent).toContain('p_justificativa TEXT DEFAULT NULL');
      // 2. Atualiza a coluna canônica real da tabela: justificativa_devolucao
      expect(sqlContent).toContain('justificativa_devolucao = COALESCE(p_justificativa, justificativa_devolucao)');
      // 3. NÃO deve possuir referência à coluna inexistente justificativa =
      expect(sqlContent).not.toMatch(/[\s,]justificativa\s*=\s*COALESCE/);
      expect(sqlContent).not.toMatch(/SET[\s\S]*?\bjustificativa\s*=/i);
    });
  });

  describe('Simulação Funcional e de Segurança da RPC rpc_custo_extra_transicionar', () => {
    interface ContextoOperador {
      userId: string | null;
      tenantId: string | null;
      role: string | null;
      isServiceRole?: boolean;
    }

    interface RegistroCustoExtra {
      id: string;
      tenant_id: string;
      pipeline_status: string;
      status_pagamento: string;
      origem_recurso: 'PAGO_EMPRESA' | 'REEMBOLSO_COLABORADOR' | 'PAGAMENTO_PENDENTE' | 'LEGACY';
      atualizado_em: string;
      deleted_at: string | null;
    }

    // Função que espelha deterministicamente o fluxo PL/pgSQL implementado na migration
    function simularRpcTransicionar(
      operador: ContextoOperador,
      reg: RegistroCustoExtra | null,
      acao: string,
      updatedAt: string,
      justificativa?: string
    ): { pipeline_status: string; status_pagamento: string } {
      // 1. Autenticação fail-closed
      if (!operador.userId && !operador.isServiceRole) {
        throw new Error('AUTH_REQUIRED: Operação restrita a usuários autenticados.');
      }

      // 2. Tenant e Role fail-closed
      if (!operador.isServiceRole) {
        if (!operador.tenantId) {
          throw new Error('TENANT_REQUIRED: Não foi possível determinar o tenant do usuário autenticado.');
        }
        if (!operador.role) {
          throw new Error('ROLE_NOT_AUTHORIZED: Usuário autenticado não possui perfil (role) configurado.');
        }

        const roleLower = operador.role.toLowerCase();
        if (acao === 'finalizar_pagamento') {
          if (!['admin', 'financeiro'].includes(roleLower)) {
            throw new Error(`ROLE_NOT_AUTHORIZED: Apenas usuários com perfil admin ou financeiro podem liquidar pagamentos. Perfil: ${roleLower}`);
          }
        } else if (['avancar_validacao', 'aprovar', 'enviar_financeiro', 'devolver'].includes(acao)) {
          if (!['admin', 'rh', 'financeiro'].includes(roleLower)) {
            throw new Error(`ROLE_NOT_AUTHORIZED: Perfil não autorizado para transicionar custos extras. Perfil: ${roleLower}`);
          }
        } else {
          throw new Error(`Açao de transicao desconhecida: ${acao}`);
        }
      }

      // 3. Registro inexistente
      if (!reg) {
        throw new Error('REGISTRO_NOT_FOUND: Custo extra não encontrado.');
      }

      // 4. Cross-tenant fail-closed
      if (!operador.isServiceRole && reg.tenant_id !== operador.tenantId) {
        throw new Error('TENANT_MISMATCH: Acesso negado. O registro de custo extra pertence a outro tenant.');
      }

      // 5. OCC
      if (reg.atualizado_em !== updatedAt) {
        throw new Error('CONCORRENCIA: Registro modificado por outro usuário. Recarregue a página.');
      }

      // 6. Soft delete
      if (reg.deleted_at !== null) {
        throw new Error('ESTADO_INVALIDO: Registro foi excluído logicamente.');
      }

      let novoPipeline = reg.pipeline_status;
      let novoPagamento = reg.status_pagamento;

      // 7. Máquina de estados
      if (acao === 'avancar_validacao') {
        if (reg.pipeline_status !== 'RECEBIDO') {
          throw new Error(`Estado atual (${reg.pipeline_status}) não permite acao de avancar_validacao.`);
        }
        novoPipeline = 'EM_VALIDACAO';
      } else if (acao === 'aprovar') {
        if (!['EM_VALIDACAO', 'RECEBIDO'].includes(reg.pipeline_status)) {
          throw new Error(`Estado atual (${reg.pipeline_status}) não permite acao de aprovar.`);
        }
        if (reg.origem_recurso === 'PAGO_EMPRESA') {
          novoPipeline = 'FINALIZADO';
          novoPagamento = 'PAGO';
        } else if (reg.origem_recurso === 'REEMBOLSO_COLABORADOR' || reg.origem_recurso === 'PAGAMENTO_PENDENTE') {
          novoPipeline = 'APROVADO_OPERACAO';
          novoPagamento = 'A_PAGAR';
        } else if (reg.origem_recurso === 'LEGACY') {
          // LEGACY explícito
          novoPipeline = 'APROVADO_OPERACAO';
          novoPagamento = reg.status_pagamento || 'A_PAGAR';
        } else {
          throw new Error(`ORIGEM_RECURSO_INVALIDA: Origem de recurso (${reg.origem_recurso}) não reconhecida para aprovação.`);
        }
      } else if (acao === 'enviar_financeiro') {
        if (reg.pipeline_status !== 'APROVADO_OPERACAO') {
          throw new Error(`Estado atual (${reg.pipeline_status}) não permite acao de enviar_financeiro.`);
        }
        if (!['REEMBOLSO_COLABORADOR', 'PAGAMENTO_PENDENTE', 'LEGACY'].includes(reg.origem_recurso)) {
          if (reg.origem_recurso === 'PAGO_EMPRESA') {
            throw new Error('Ação não permitida: registro com origem PAGO_EMPRESA já foi finalizado na aprovação e não deve ser enviado ao financeiro.');
          }
          throw new Error(`Origem de recurso inválida para envio ao financeiro: ${reg.origem_recurso}`);
        }
        novoPipeline = 'ENVIADO_FINANCEIRO';
        novoPagamento = 'A_PAGAR';
      } else if (acao === 'finalizar_pagamento') {
        if (reg.origem_recurso === 'PAGO_EMPRESA') {
          throw new Error('Ação não permitida: despesa PAGO_EMPRESA já foi liquidada pela empresa e não gera pagamento adicional.');
        }
        if (!['REEMBOLSO_COLABORADOR', 'PAGAMENTO_PENDENTE', 'LEGACY'].includes(reg.origem_recurso)) {
          throw new Error(`Origem de recurso inválida para liquidação financeira: ${reg.origem_recurso}`);
        }
        if (reg.pipeline_status !== 'ENVIADO_FINANCEIRO') {
          throw new Error(`Estado atual (${reg.pipeline_status}) não permite liquidação financeira. Registro deve estar em ENVIADO_FINANCEIRO.`);
        }
        if (reg.status_pagamento !== 'A_PAGAR') {
          if (reg.status_pagamento === 'PAGO') throw new Error('Idempotente: O registro já está pago.');
          throw new Error(`Status de pagamento atual (${reg.status_pagamento}) não permite baixa. Deve estar A_PAGAR.`);
        }
        novoPipeline = 'FINALIZADO';
        novoPagamento = 'PAGO';
      } else if (acao === 'devolver') {
        if (reg.pipeline_status === 'FINALIZADO') {
          throw new Error('Estado FINALIZADO é terminal e não permite devolução pela ação padrão.');
        }
        if (reg.status_pagamento === 'PAGO') {
          throw new Error('Ação não permitida: despesa com status de pagamento PAGO não pode ser devolvida à operação. Requer estorno/reabertura financeira específica.');
        }
        if (!['EM_VALIDACAO', 'APROVADO_OPERACAO', 'ENVIADO_FINANCEIRO'].includes(reg.pipeline_status)) {
          throw new Error(`Estado atual (${reg.pipeline_status}) não permite devolução.`);
        }
        if (!justificativa || justificativa.trim() === '') {
          throw new Error('Justificativa obrigatoria para devolução.');
        }
        novoPipeline = 'RECEBIDO';
      } else {
        throw new Error(`Açao de transicao desconhecida: ${acao}`);
      }

      return { pipeline_status: novoPipeline, status_pagamento: novoPagamento };
    }

    const tenantA = '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
    const tenantB = '11111111-2222-3333-4444-555555555555';

    const opAdminTenantA: ContextoOperador = {
      userId: 'user-admin-1',
      tenantId: tenantA,
      role: 'admin',
    };

    const opRhTenantA: ContextoOperador = {
      userId: 'user-rh-1',
      tenantId: tenantA,
      role: 'rh',
    };

    const opFinTenantA: ContextoOperador = {
      userId: 'user-fin-1',
      tenantId: tenantA,
      role: 'financeiro',
    };

    const opEncarregadoTenantA: ContextoOperador = {
      userId: 'user-enc-1',
      tenantId: tenantA,
      role: 'encarregado',
    };

    const opTenantB: ContextoOperador = {
      userId: 'user-other-tenant',
      tenantId: tenantB,
      role: 'admin',
    };

    const registroBase: RegistroCustoExtra = {
      id: 'dcba0376-4743-4d04-bc84-b7f65cec41ae',
      tenant_id: tenantA,
      pipeline_status: 'EM_VALIDACAO',
      status_pagamento: 'A_PAGAR',
      origem_recurso: 'PAGO_EMPRESA',
      atualizado_em: '2026-09-18T10:00:00Z',
      deleted_at: null,
    };

    // --- TESTES NEGATIVOS DE SEGURANÇA ---
    it('TESTE NEGATIVO 1: Usuário não autenticado deve falhar com AUTH_REQUIRED', () => {
      const opAnonimo: ContextoOperador = { userId: null, tenantId: null, role: null };
      expect(() => {
        simularRpcTransicionar(opAnonimo, registroBase, 'aprovar', '2026-09-18T10:00:00Z');
      }).toThrow(/AUTH_REQUIRED/);
    });

    it('TESTE NEGATIVO 2: Usuário de outro tenant deve falhar com TENANT_MISMATCH', () => {
      expect(() => {
        simularRpcTransicionar(opTenantB, registroBase, 'aprovar', '2026-09-18T10:00:00Z');
      }).toThrow(/TENANT_MISMATCH/);
    });

    it('TESTE NEGATIVO 3: Usuário autenticado sem role autorizada (encarregado) deve falhar com ROLE_NOT_AUTHORIZED', () => {
      expect(() => {
        simularRpcTransicionar(opEncarregadoTenantA, registroBase, 'aprovar', '2026-09-18T10:00:00Z');
      }).toThrow(/ROLE_NOT_AUTHORIZED/);
    });

    it('TESTE NEGATIVO 4: Usuário com role RH tentando finalizar_pagamento deve falhar com ROLE_NOT_AUTHORIZED', () => {
      const regParaBaixa: RegistroCustoExtra = {
        ...registroBase,
        pipeline_status: 'ENVIADO_FINANCEIRO',
        origem_recurso: 'REEMBOLSO_COLABORADOR',
      };
      expect(() => {
        simularRpcTransicionar(opRhTenantA, regParaBaixa, 'finalizar_pagamento', '2026-09-18T10:00:00Z');
      }).toThrow(/Apenas usuários com perfil admin ou financeiro podem liquidar pagamentos/);
    });

    it('TESTE NEGATIVO 5: Registro inexistente deve falhar com REGISTRO_NOT_FOUND', () => {
      expect(() => {
        simularRpcTransicionar(opAdminTenantA, null, 'aprovar', '2026-09-18T10:00:00Z');
      }).toThrow(/REGISTRO_NOT_FOUND/);
    });

    it('TESTE NEGATIVO 6: enviar_financeiro em PAGO_EMPRESA deve ser bloqueado', () => {
      const regAprovado: RegistroCustoExtra = {
        ...registroBase,
        pipeline_status: 'APROVADO_OPERACAO',
        origem_recurso: 'PAGO_EMPRESA',
      };
      expect(() => {
        simularRpcTransicionar(opAdminTenantA, regAprovado, 'enviar_financeiro', '2026-09-18T10:00:00Z');
      }).toThrow(/PAGO_EMPRESA já foi finalizado na aprovação e não deve ser enviado ao financeiro/);
    });

    it('TESTE NEGATIVO 7: enviar_financeiro fail-closed em origem de recurso não prevista', () => {
      const regInvalido: any = {
        ...registroBase,
        pipeline_status: 'APROVADO_OPERACAO',
        origem_recurso: 'ORIGEM_DESCONHECIDA',
      };
      expect(() => {
        simularRpcTransicionar(opAdminTenantA, regInvalido, 'enviar_financeiro', '2026-09-18T10:00:00Z');
      }).toThrow(/Origem de recurso inválida para envio ao financeiro/);
    });

    it('TESTE NEGATIVO 8: devolver deve ser bloqueado quando status_pagamento for PAGO', () => {
      const regJaPago: RegistroCustoExtra = {
        ...registroBase,
        pipeline_status: 'ENVIADO_FINANCEIRO',
        status_pagamento: 'PAGO',
        origem_recurso: 'REEMBOLSO_COLABORADOR',
      };
      expect(() => {
        simularRpcTransicionar(opFinTenantA, regJaPago, 'devolver', '2026-09-18T10:00:00Z', 'Motivo devolução');
      }).toThrow(/status de pagamento PAGO não pode ser devolvida à operação.*Requer estorno/);
    });

    it('TESTE NEGATIVO 9: devolver deve ser bloqueado quando pipeline_status for FINALIZADO', () => {
      const regFinalizado: RegistroCustoExtra = {
        ...registroBase,
        pipeline_status: 'FINALIZADO',
        status_pagamento: 'PAGO',
        origem_recurso: 'PAGO_EMPRESA',
      };
      expect(() => {
        simularRpcTransicionar(opAdminTenantA, regFinalizado, 'devolver', '2026-09-18T10:00:00Z', 'Motivo devolução');
      }).toThrow(/Estado FINALIZADO é terminal/);
    });

    it('TESTE NEGATIVO 10: devolver deve exigir justificativa preenchida', () => {
      const regDevolucao: RegistroCustoExtra = {
        ...registroBase,
        pipeline_status: 'EM_VALIDACAO',
        status_pagamento: 'A_PAGAR',
        origem_recurso: 'REEMBOLSO_COLABORADOR',
      };
      expect(() => {
        simularRpcTransicionar(opRhTenantA, regDevolucao, 'devolver', '2026-09-18T10:00:00Z', '   ');
      }).toThrow(/Justificativa obrigatoria/);
    });

    it('TESTE NEGATIVO 11: finalizar_pagamento em PAGO_EMPRESA deve ser bloqueado', () => {
      const regPagoEmpresa: RegistroCustoExtra = {
        ...registroBase,
        pipeline_status: 'ENVIADO_FINANCEIRO',
        status_pagamento: 'A_PAGAR',
        origem_recurso: 'PAGO_EMPRESA',
      };
      expect(() => {
        simularRpcTransicionar(opFinTenantA, regPagoEmpresa, 'finalizar_pagamento', '2026-09-18T10:00:00Z');
      }).toThrow(/Ação não permitida: despesa PAGO_EMPRESA já foi liquidada pela empresa/);
    });

    it('TESTE NEGATIVO 12: Concorrência (OCC com timestamp divergente) deve abortar transição', () => {
      expect(() => {
        simularRpcTransicionar(opAdminTenantA, registroBase, 'aprovar', '2026-09-18T09:00:00Z');
      }).toThrow(/CONCORRENCIA/);
    });

    it('TESTE NEGATIVO 13: Registro com soft delete (deleted_at preenchido) deve abortar', () => {
      const regDeletado: RegistroCustoExtra = {
        ...registroBase,
        deleted_at: '2026-09-18T09:30:00Z',
      };
      expect(() => {
        simularRpcTransicionar(opAdminTenantA, regDeletado, 'aprovar', '2026-09-18T10:00:00Z');
      }).toThrow(/ESTADO_INVALIDO/);
    });

    // --- TESTES POSITIVOS COM USUÁRIO AUTORIZADO DO TENANT CORRETO ---
    it('TESTE POSITIVO 14: Usuário autorizado (admin/rh) do tenant correto aprova PAGO_EMPRESA -> FINALIZADO / PAGO (Modelo A)', () => {
      const res = simularRpcTransicionar(opRhTenantA, registroBase, 'aprovar', '2026-09-18T10:00:00Z');
      expect(res.pipeline_status).toBe('FINALIZADO');
      expect(res.status_pagamento).toBe('PAGO');
    });

    it('TESTE POSITIVO 15: Usuário autorizado aprova REEMBOLSO_COLABORADOR -> APROVADO_OPERACAO / A_PAGAR', () => {
      const regReembolso: RegistroCustoExtra = {
        ...registroBase,
        origem_recurso: 'REEMBOLSO_COLABORADOR',
      };
      const res = simularRpcTransicionar(opRhTenantA, regReembolso, 'aprovar', '2026-09-18T10:00:00Z');
      expect(res.pipeline_status).toBe('APROVADO_OPERACAO');
      expect(res.status_pagamento).toBe('A_PAGAR');
    });

    it('TESTE POSITIVO 16: Usuário financeiro ou admin do tenant correto liquida REEMBOLSO via finalizar_pagamento', () => {
      const regFinanceiro: RegistroCustoExtra = {
        ...registroBase,
        pipeline_status: 'ENVIADO_FINANCEIRO',
        status_pagamento: 'A_PAGAR',
        origem_recurso: 'REEMBOLSO_COLABORADOR',
      };
      const res = simularRpcTransicionar(opFinTenantA, regFinanceiro, 'finalizar_pagamento', '2026-09-18T10:00:00Z');
      expect(res.pipeline_status).toBe('FINALIZADO');
      expect(res.status_pagamento).toBe('PAGO');
    });

    it('TESTE POSITIVO 17: Preservação de compatibilidade LEGACY em aprovação, envio financeiro e baixa', () => {
      const regLegacy: RegistroCustoExtra = {
        ...registroBase,
        origem_recurso: 'LEGACY',
      };

      // 1. Aprovação
      const step1 = simularRpcTransicionar(opRhTenantA, regLegacy, 'aprovar', '2026-09-18T10:00:00Z');
      expect(step1.pipeline_status).toBe('APROVADO_OPERACAO');
      expect(step1.status_pagamento).toBe('A_PAGAR');

      // 2. Envio financeiro
      regLegacy.pipeline_status = step1.pipeline_status;
      const step2 = simularRpcTransicionar(opAdminTenantA, regLegacy, 'enviar_financeiro', '2026-09-18T10:00:00Z');
      expect(step2.pipeline_status).toBe('ENVIADO_FINANCEIRO');
      expect(step2.status_pagamento).toBe('A_PAGAR');

      // 3. Liquidação
      regLegacy.pipeline_status = step2.pipeline_status;
      const step3 = simularRpcTransicionar(opFinTenantA, regLegacy, 'finalizar_pagamento', '2026-09-18T10:00:00Z');
      expect(step3.pipeline_status).toBe('FINALIZADO');
      expect(step3.status_pagamento).toBe('PAGO');
    });

    it('TESTE NEGATIVO 18: aprovar com origem desconhecida/nula deve falhar com ORIGEM_RECURSO_INVALIDA e NÃO cair em LEGACY', () => {
      const regOrigemInvalida: any = {
        ...registroBase,
        origem_recurso: 'ORIGEM_DESCONHECIDA',
      };
      expect(() => {
        simularRpcTransicionar(opRhTenantA, regOrigemInvalida, 'aprovar', '2026-09-18T10:00:00Z');
      }).toThrow(/ORIGEM_RECURSO_INVALIDA/);

      const regOrigemNula: any = {
        ...registroBase,
        origem_recurso: null,
      };
      expect(() => {
        simularRpcTransicionar(opRhTenantA, regOrigemNula, 'aprovar', '2026-09-18T10:00:00Z');
      }).toThrow(/ORIGEM_RECURSO_INVALIDA/);
    });
  });
});
