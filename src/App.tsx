import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { SelectionProvider } from "@/contexts/SelectionContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ClientProvider } from "@/contexts/ClientContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { AuthGuard } from "@/components/Auth/AuthGuard";
import { PortalGuard } from "@/components/Auth/PortalGuard";
import { AIChat } from "@/components/AIChat";

// Auth Pages
import Login from "./pages/Auth/Login";
import Cadastro from "./pages/Auth/Cadastro";
import EsqueciSenha from "./pages/Auth/EsqueciSenha";
import RedefinirSenha from "./pages/Auth/RedefinirSenha";
import VerificarEmail from "./pages/Auth/VerificarEmail";

import Dashboard from "./pages/Dashboard";
import Pontos from "./pages/Pontos";
import Operacoes from "./pages/Operacoes";
import CentralCadastros from "./pages/CentralCadastros";
import CentralRelatoriosIntegracoes from "./pages/CentralRelatoriosIntegracoes";
import Colaboradores from "./pages/Colaboradores";
import Transportadoras from "./pages/Transportadoras";
import Fornecedores from "./pages/Fornecedores";
import Servicos from "./pages/Servicos";
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
import CentralFinanceira from "./pages/CentralFinanceira";
import CentralBancaria from "./pages/CentralBancaria";
import RegrasCalculo from "./pages/Financeiro/RegrasCalculo";
import FaturamentoCliente from "./pages/Financeiro/FaturamentoCliente";
import DetalhamentoCliente from "./pages/Financeiro/DetalhamentoCliente";
import DetalhamentoColaborador from "./pages/Financeiro/DetalhamentoColaborador";
import RemessaCNAB from "./pages/Financeiro/RemessaCNAB";
import HistoricoRemessas from "./pages/Financeiro/HistoricoRemessas";
import RetornoBancario from "./pages/Financeiro/RetornoBancario";
import ClientDashboard from "./pages/Cliente/ClientDashboard";
import ClientReports from "./pages/Cliente/ClientReports";
import ClientApprovals from "./pages/Cliente/ClientApprovals";
import Configuracoes from "./pages/Configuracoes";
import Styleguide from "./pages/Styleguide";
import NotFound from "./pages/NotFound";

// V4 — Banco de Horas
import PainelGeralBH from "./pages/BancoHoras/PainelGeral";
import RegrasBH from "./pages/BancoHoras/Regras";
import ExtratoColaborador from "./pages/BancoHoras/ExtratoColaborador";
import ProcessamentoRH from "./pages/BancoHoras/ProcessamentoRH";

// V4 — Governança
import UsuariosGestao from "./pages/Governanca/Usuarios";
import PerfisPermissoes from "./pages/Governanca/Perfis";
import AuditoriaLogs from "./pages/Governanca/Auditoria";
import LancamentoProducao from "./pages/LancamentoProducao";
import LoginOperacional from "./pages/Auth/LoginOperacional";
import CentralGovernanca from "./pages/CentralGovernanca";
import RegrasOperacionais from "./pages/RegrasOperacionais";
import CentralOperacional from "./pages/CentralOperacional";

// Módulo Diaristas
import DiaristasLancamento from "./pages/Producao/DiaristasLancamento";
import RhDiaristasPainel from "./pages/Rh/RhDiaristasPainel";
import RhDiaristasGestao from "./pages/Rh/RhDiaristasGestao";

// Onboarding
import Onboarding from "./pages/Onboarding";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <OnboardingProvider>
          <ClientProvider>
            <PreferencesProvider>
              <SelectionProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <Routes>
                      {/* Public Auth Routes */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/login/operacional" element={<LoginOperacional />} />
                      <Route path="/cadastro" element={<Cadastro />} />
                      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
                      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
                      <Route path="/verificar-email" element={<VerificarEmail />} />

                      {/* Protected Routes */}
                      <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
                      <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
                      <Route path="/central" element={<AuthGuard><CentralOperacional /></AuthGuard>} />
                      <Route path="/operacional" element={<Navigate to="/operacional/dashboard" replace />} />
                      <Route path="/operacional/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
                      <Route path="/operacional/pontos" element={<AuthGuard><Pontos /></AuthGuard>} />
                      <Route path="/operacional/operacoes" element={<AuthGuard><Operacoes /></AuthGuard>} />
                      <Route path="/producao" element={<AuthGuard><LancamentoProducao /></AuthGuard>} />
                      <Route path="/producao/diaristas" element={<AuthGuard><DiaristasLancamento /></AuthGuard>} />
                      <Route path="/rh/diaristas" element={<AuthGuard><RhDiaristasPainel /></AuthGuard>} />
                      <Route path="/rh/diaristas/cadastros" element={<AuthGuard><RhDiaristasGestao /></AuthGuard>} />
                      <Route path="/processamento" element={<Navigate to="/operacional/operacoes" replace />} />
                      <Route path="/processamento/legado" element={<Navigate to="/operacional/operacoes" replace />} />
                      <Route path="/cadastros" element={<AuthGuard><CentralCadastros /></AuthGuard>} />
                      <Route path="/cadastros/regras-operacionais" element={<AuthGuard><RegrasOperacionais /></AuthGuard>} />
                      <Route path="/colaboradores" element={<AuthGuard><Colaboradores /></AuthGuard>} />
                      <Route path="/transportadoras" element={<AuthGuard><Transportadoras /></AuthGuard>} />
                      <Route path="/fornecedores" element={<AuthGuard><Fornecedores /></AuthGuard>} />
                      <Route path="/servicos" element={<AuthGuard><Servicos /></AuthGuard>} />
                      <Route path="/empresas" element={<AuthGuard><Empresas /></AuthGuard>} />
                      <Route path="/coletores" element={<AuthGuard><Coletores /></AuthGuard>} />
                      <Route path="/importacoes" element={<AuthGuard><Importacoes /></AuthGuard>} />
                      <Route path="/inconsistencias" element={<AuthGuard><Inconsistencias /></AuthGuard>} />

                      {/* Financeiro V3 */}
                      <Route path="/financeiro" element={<AuthGuard><CentralFinanceira /></AuthGuard>} />
                      <Route path="/financeiro/legado" element={<AuthGuard><FinanceiroGeral /></AuthGuard>} />
                      <Route path="/bancario" element={<AuthGuard><CentralBancaria /></AuthGuard>} />
                      <Route path="/financeiro/regras" element={<AuthGuard><RegrasCalculo /></AuthGuard>} />
                      <Route path="/financeiro/faturamento" element={<AuthGuard><FaturamentoCliente /></AuthGuard>} />
                      <Route path="/financeiro/faturamento/:id" element={<AuthGuard><DetalhamentoCliente /></AuthGuard>} />
                      <Route path="/financeiro/colaborador/:id" element={<AuthGuard><DetalhamentoColaborador /></AuthGuard>} />
                      <Route path="/financeiro/remessa" element={<AuthGuard><RemessaCNAB /></AuthGuard>} />
                      <Route path="/financeiro/remessa/historico" element={<AuthGuard><HistoricoRemessas /></AuthGuard>} />
                      <Route path="/financeiro/retorno" element={<AuthGuard><RetornoBancario /></AuthGuard>} />

                      {/* Portal Cliente V3 */}
                      <Route path="/cliente/dashboard" element={<PortalGuard><ClientDashboard /></PortalGuard>} />
                      <Route path="/cliente/relatorios" element={<PortalGuard><ClientReports /></PortalGuard>} />
                      <Route path="/cliente/aprovacoes" element={<PortalGuard><ClientApprovals /></PortalGuard>} />

                      <Route path="/fechamento" element={<AuthGuard><Fechamento /></AuthGuard>} />

                      {/* Relatórios e Integração V4 */}
                      <Route path="/relatorios" element={<AuthGuard><CentralRelatoriosIntegracoes /></AuthGuard>} />
                      <Route path="/relatorios/legado" element={<AuthGuard><RelatoriosHub /></AuthGuard>} />
                      <Route path="/relatorios/detalhe/:id" element={<AuthGuard><RelatorioDetalhe /></AuthGuard>} />
                      <Route path="/relatorios/agendamentos" element={<AuthGuard><Agendamentos /></AuthGuard>} />
                      <Route path="/relatorios/layouts" element={<AuthGuard><LayoutsExportacao /></AuthGuard>} />
                      <Route path="/relatorios/integracao" element={<AuthGuard><IntegracaoContabil /></AuthGuard>} />
                      <Route path="/relatorios/mapeamento" element={<AuthGuard><MapeamentoContabil /></AuthGuard>} />
                      <Route path="/relatorios/integracao/logs" element={<AuthGuard><LogsIntegracao /></AuthGuard>} />

                      {/* Banco de Horas V4 */}
                      <Route path="/banco-horas" element={<AuthGuard><PainelGeralBH /></AuthGuard>} />
                      <Route path="/banco-horas/regras" element={<AuthGuard><RegrasBH /></AuthGuard>} />
                      <Route path="/banco-horas/extrato/:id" element={<AuthGuard><ExtratoColaborador /></AuthGuard>} />
                      <Route path="/banco-horas/processamento" element={<AuthGuard><ProcessamentoRH /></AuthGuard>} />

                      {/* Governança V4 */}
                      <Route path="/governanca" element={<AuthGuard><CentralGovernanca /></AuthGuard>} />
                      <Route path="/governanca/usuarios" element={<AuthGuard><UsuariosGestao /></AuthGuard>} />
                      <Route path="/governanca/perfis" element={<AuthGuard><PerfisPermissoes /></AuthGuard>} />
                      <Route path="/governanca/auditoria" element={<AuthGuard><AuditoriaLogs /></AuthGuard>} />

                      <Route path="/configuracoes" element={<AuthGuard><Configuracoes /></AuthGuard>} />

                      {/* Development Tools */}
                      <Route path="/styleguide" element={<Styleguide />} />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <AIChat />
                  </BrowserRouter>
                </TooltipProvider>
              </SelectionProvider>
            </PreferencesProvider>
          </ClientProvider>
        </OnboardingProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

