import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";
import { LoteFechamentoDiaristaService } from "@/services/domain/diaristas.service";
import {
  getRouteAccessRule,
  canAccessModule,
  ACCESS_PRESETS,
} from "@/lib/access-control";

describe("CONV-17 / ETAPA 02 — Saneamento de Contratos e Navegação (Intermitentes)", () => {
  // =========================================================================
  // BLOCO A — Auditoria de Contratos CNAB
  // =========================================================================
  describe("BLOCO A — Contrato CNAB", () => {
    it("01. Confirma que gerarRemessaCNAB é inexistente em tempo de execução no IntermitentesLoteService", () => {
      expect((IntermitentesLoteService as any).gerarRemessaCNAB).toBeUndefined();
    });

    it("02. Confirma que gerarRemessaCNAB é também inexistente em LoteFechamentoDiaristaService", () => {
      expect((LoteFechamentoDiaristaService as any).gerarRemessaCNAB).toBeUndefined();
    });

    it("03. Confirma que o método canônico implementado é gerarCNABParaLote", () => {
      expect(typeof IntermitentesLoteService.gerarCNABParaLote).toBe("function");
      expect(typeof LoteFechamentoDiaristaService.gerarCNABParaLote).toBe("function");
    });

    it("04. Confirma que CentralBancariaDrawerOficial foi saneado e chama diretamente gerarCNABParaLote", () => {
      const drawerPath = path.resolve(
        process.cwd(),
        "src/components/bancario/CentralBancariaDrawerOficial.tsx"
      );
      const drawerContent = fs.readFileSync(drawerPath, "utf-8");

      expect(drawerContent).toContain("IntermitentesLoteService.gerarCNABParaLote");
      expect(drawerContent).toContain("LoteFechamentoDiaristaService.gerarCNABParaLote");
      expect(drawerContent).not.toContain("IntermitentesLoteService.gerarRemessaCNAB");
      expect(drawerContent).not.toContain("LoteFechamentoDiaristaService.gerarRemessaCNAB");
    });

    it("05. Confirma que o motor canônico gerarCNABParaLote exige lote aprovado pelo financeiro (fail-closed)", async () => {
      await expect(
        IntermitentesLoteService.gerarCNABParaLote({
          loteId: "inexistente-ou-invalido",
          empresaId: "empresa-1",
          geradoPor: "test-user",
          geradoPorNome: "Test",
          empresaRemetente: {
            cnpj: "00000000000191",
            razao_social: "Empresa Teste",
            banco_codigo: "001",
            agencia: "1234",
            conta: "56789",
          },
        })
      ).rejects.toThrow();
    }, 15000);
  });

  // =========================================================================
  // BLOCO B — Navegação para Central Bancária
  // =========================================================================
  describe("BLOCO B — Navegação para Central Bancária", () => {
    it("06. CentralBancaria.tsx aceita tab=intermitentes e origem=INTERMITENTE na resolução inicial", () => {
      const centralPath = path.resolve(
        process.cwd(),
        "src/pages/CentralBancaria.tsx"
      );
      const centralContent = fs.readFileSync(centralPath, "utf-8");

      // Confirma que CentralBancaria trata tab=intermitentes para setar origemFiltro
      expect(centralContent).toContain('if (tab === "intermitentes") return "INTERMITENTES"');
      expect(centralContent).toContain('if (orig === "INTERMITENTE") return "INTERMITENTES"');
    });

    it("07. IntermitentesLotes.tsx utiliza atalho canônico /bancario?tab=intermitentes&origem=INTERMITENTE", () => {
      const lotesPath = path.resolve(
        process.cwd(),
        "src/pages/Operacional/IntermitentesLotes.tsx"
      );
      const lotesContent = fs.readFileSync(lotesPath, "utf-8");

      expect(lotesContent).toContain("/bancario?tab=intermitentes&origem=INTERMITENTE");
      expect(lotesContent).toContain("/bancario?tab=retorno&origem=INTERMITENTE");
    });
  });

  // =========================================================================
  // BLOCO C — Permissões e Rotas
  // =========================================================================
  describe("BLOCO C — Permissões e Rotas", () => {
    it("08. /operacional/intermitentes está mapeado para operacoes_recebidas", () => {
      const rule = getRouteAccessRule("/operacional/intermitentes");
      expect(rule).toBeDefined();
      expect(rule?.module).toBe("operacoes_recebidas");

      // Perfil Encarregado NÃO tem operacoes_recebidas
      const encarregadoPerms = ACCESS_PRESETS.encarregado;
      expect(canAccessModule(encarregadoPerms, "operacoes_recebidas")).toBe(false);

      // Perfil Gestor tem operacoes_recebidas
      const gestorPerms = ACCESS_PRESETS.gestor;
      expect(canAccessModule(gestorPerms, "operacoes_recebidas")).toBe(true);
    });

    it("09. /operacional/intermitentes/lotes herda o prefixo /operacional/intermitentes", () => {
      const rule = getRouteAccessRule("/operacional/intermitentes/lotes");
      expect(rule).toBeDefined();
      expect(rule?.module).toBe("operacoes_recebidas");
    });

    it("10. /intermitentes/aprovacoes está mapeado para processamento_rh", () => {
      const rule = getRouteAccessRule("/intermitentes/aprovacoes");
      expect(rule).toBeDefined();
      expect(rule?.module).toBe("processamento_rh");

      // Perfil RH tem processamento_rh
      const rhPerms = ACCESS_PRESETS.rh;
      expect(canAccessModule(rhPerms, "processamento_rh")).toBe(true);

      // Perfil Encarregado NÃO tem processamento_rh
      const encarregadoPerms = ACCESS_PRESETS.encarregado;
      expect(canAccessModule(encarregadoPerms, "processamento_rh")).toBe(false);
    });

    it("11. Confirma que /intermitentes/lotes, /intermitentes/inconsistencias e /inconsistencias estão explicitamente protegidas", () => {
      const ruleLotesAlias = getRouteAccessRule("/intermitentes/lotes");
      const ruleInconsistenciasAlias = getRouteAccessRule("/intermitentes/inconsistencias");
      const ruleInconsistencias = getRouteAccessRule("/inconsistencias");

      expect(ruleLotesAlias).toBeDefined();
      expect(ruleLotesAlias?.module).toBe("operacoes_recebidas");

      expect(ruleInconsistenciasAlias).toBeDefined();
      expect(ruleInconsistenciasAlias?.module).toBe("operacoes_recebidas");

      expect(ruleInconsistencias).toBeDefined();
      expect(ruleInconsistencias?.module).toBe("fechamento_mensal");
    });
  });
});
