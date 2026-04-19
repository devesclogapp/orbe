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
import Relatorios from "./pages/Relatorios";
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
              <Route path="/relatorios" element={<Relatorios />} />
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
