import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { SelectionProvider } from "@/contexts/SelectionContext";
import { AIChat } from "@/components/AIChat";
import Dashboard from "./pages/Dashboard";
import Processamento from "./pages/Processamento";
import Colaboradores from "./pages/Colaboradores";
import Empresas from "./pages/Empresas";
import Coletores from "./pages/Coletores";
import Importacoes from "./pages/Importacoes";
import Fechamento from "./pages/Fechamento";

// Relatórios e Integração V4
import RelatoriosHub from "./pages/Relatorios/RelatoriosHub";
import RelatorioDetalhe from "./pages/Relatorios/RelatorioDetalhe";
import Agendamentos from "./pages/Relatorios/Agendamentos";
import LayoutsExportacao from "./pages/Relatorios/LayoutsExportacao";
import IntegracaoContabil from "./pages/Relatorios/IntegracaoContabil";
import MapeamentoContabil from "./pages/Relatorios/MapeamentoContabil";
import LogsIntegracao from "./pages/Relatorios/LogsIntegracao";

import Inconsistencias from "./pages/Inconsistencias";

import FinanceiroGeral from "./pages/Financeiro/FinanceiroGeral";
import RegrasCalculo from "./pages/Financeiro/RegrasCalculo";
import FaturamentoCliente from "./pages/Financeiro/FaturamentoCliente";
import DetalhamentoColaborador from "./pages/Financeiro/DetalhamentoColaborador";
import RemessaCNAB from "./pages/Financeiro/RemessaCNAB";
import HistoricoRemessas from "./pages/Financeiro/HistoricoRemessas";
import RetornoBancario from "./pages/Financeiro/RetornoBancario";
import ClientDashboard from "./pages/Cliente/ClientDashboard";
import ClientReports from "./pages/Cliente/ClientReports";
import ClientApprovals from "./pages/Cliente/ClientApprovals";
import Configuracoes from "./pages/Configuracoes";
import Styleguide from "./pages/Styleguide";
import NotFound from "./pages/NotFound.tsx";

// V4 — Banco de Horas
import PainelGeralBH from "./pages/BancoHoras/PainelGeral";
import RegrasBH from "./pages/BancoHoras/Regras";
import ExtratoColaborador from "./pages/BancoHoras/ExtratoColaborador";

// V4 — Governança
import UsuariosGestao from "./pages/Governanca/Usuarios";
import PerfisPermissoes from "./pages/Governanca/Perfis";
import AuditoriaLogs from "./pages/Governanca/Auditoria";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PreferencesProvider>
      <SelectionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/processamento" element={<Processamento />} />
              <Route path="/colaboradores" element={<Colaboradores />} />
              <Route path="/empresas" element={<Empresas />} />
              <Route path="/coletores" element={<Coletores />} />
              <Route path="/importacoes" element={<Importacoes />} />
              <Route path="/inconsistencias" element={<Inconsistencias />} />

              {/* Financeiro V3 */}
              <Route path="/financeiro" element={<FinanceiroGeral />} />
              <Route path="/financeiro/regras" element={<RegrasCalculo />} />
              <Route path="/financeiro/faturamento" element={<FaturamentoCliente />} />
              <Route path="/financeiro/colaborador/:id" element={<DetalhamentoColaborador />} />
              <Route path="/financeiro/remessa" element={<RemessaCNAB />} />
              <Route path="/financeiro/remessa/historico" element={<HistoricoRemessas />} />
              <Route path="/financeiro/retorno" element={<RetornoBancario />} />

              {/* Portal Cliente V3 */}
              <Route path="/cliente/dashboard" element={<ClientDashboard />} />
              <Route path="/cliente/relatorios" element={<ClientReports />} />
              <Route path="/cliente/aprovacoes" element={<ClientApprovals />} />

              <Route path="/fechamento" element={<Fechamento />} />

              {/* Relatórios e Integração V4 */}
              <Route path="/relatorios" element={<RelatoriosHub />} />
              <Route path="/relatorios/detalhe/:id" element={<RelatorioDetalhe />} />
              <Route path="/relatorios/agendamentos" element={<Agendamentos />} />
              <Route path="/relatorios/layouts" element={<LayoutsExportacao />} />
              <Route path="/relatorios/integracao" element={<IntegracaoContabil />} />
              <Route path="/relatorios/mapeamento" element={<MapeamentoContabil />} />
              <Route path="/relatorios/integracao/logs" element={<LogsIntegracao />} />

              {/* Banco de Horas V4 */}

              <Route path="/banco-horas" element={<PainelGeralBH />} />
              <Route path="/banco-horas/regras" element={<RegrasBH />} />
              <Route path="/banco-horas/extrato/:id" element={<ExtratoColaborador />} />

              {/* Governança V4 */}
              <Route path="/governanca/usuarios" element={<UsuariosGestao />} />
              <Route path="/governanca/perfis" element={<PerfisPermissoes />} />
              <Route path="/governanca/auditoria" element={<AuditoriaLogs />} />

              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/styleguide" element={<Styleguide />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <AIChat />
          </BrowserRouter>
        </TooltipProvider>
      </SelectionProvider>
    </PreferencesProvider>
  </QueryClientProvider>
);

export default App;
