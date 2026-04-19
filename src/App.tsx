import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { AIChat } from "@/components/AIChat";
import Dashboard from "./pages/Dashboard";
import Processamento from "./pages/Processamento";
import Colaboradores from "./pages/Colaboradores";
import Inconsistencias from "./pages/Inconsistencias";
import Configuracoes from "./pages/Configuracoes";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PreferencesProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/processamento" element={<Processamento />} />
            <Route path="/colaboradores" element={<Colaboradores />} />
            <Route path="/empresas" element={<PlaceholderPage title="Empresas" subtitle="Cadastro de empresas e unidades" description="Cadastro das empresas atendidas e suas unidades operacionais. Em desenvolvimento." />} />
            <Route path="/coletores" element={<PlaceholderPage title="Coletores REP" subtitle="Dispositivos de ponto" description="Lista de coletores REP cadastrados, status de conexão e última sincronização. Em desenvolvimento." />} />
            <Route path="/importacoes" element={<PlaceholderPage title="Importações" subtitle="Histórico de sincronizações" description="Histórico de importações de ponto via API e arquivo. Em desenvolvimento." />} />
            <Route path="/inconsistencias" element={<Inconsistencias />} />
            <Route path="/fechamento" element={<PlaceholderPage title="Fechamento Mensal" subtitle="Consolidação do período" description="Consolidação dos totais do mês, fechamento e reabertura de períodos. Em desenvolvimento." />} />
            <Route path="/relatorios" element={<PlaceholderPage title="Relatórios" subtitle="Visão por período" description="Relatórios consolidados por colaborador, operação e cliente. Em desenvolvimento." />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AIChat />
        </BrowserRouter>
      </TooltipProvider>
    </PreferencesProvider>
  </QueryClientProvider>
);

export default App;
