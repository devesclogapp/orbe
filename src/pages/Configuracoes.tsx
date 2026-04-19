import { AppShell } from "@/components/layout/AppShell";
import { usePreferences } from "@/contexts/PreferencesContext";
import {
  Moon,
  Sun,
  Clock,
  Boxes,
  Settings2,
  Database,
  Tag,
  CalendarDays,
  Globe,
  User,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigTable } from "@/components/ui/ConfigTable";
import { useState } from "react";

const Configuracoes = () => {
  const { theme, setTheme, defaultTab, setDefaultTab } = usePreferences();

  // Mock data for Minimum Configurations
  const [tiposOperacao, setTiposOperacao] = useState([
    { id: 1, nome: "Carga Geral", codigo: "CG", status: "ativo" },
    { id: 2, nome: "Descarga", codigo: "DESC", status: "ativo" },
    { id: 3, nome: "Paletização", codigo: "PALET", status: "ativo" },
    { id: 4, nome: "Carregamento", codigo: "CARR", status: "inativo" },
  ]);

  const [produtos, setProdutos] = useState([
    { id: 1, categoria: "Eletro", icms: "18%", status: "ativo" },
    { id: 2, categoria: "Bebidas", icms: "25%", status: "ativo" },
    { id: 3, categoria: "Móveis", icms: "12%", status: "ativo" },
    { id: 4, categoria: "Químicos", icms: "18%", status: "inativo" },
  ]);

  const [tiposDia, setTiposDia] = useState([
    { id: 1, nome: "Dia Útil", fator: "1.0", status: "ativo" },
    { id: 2, nome: "Sábado", fator: "1.5", status: "ativo" },
    { id: 3, nome: "Domingo", fator: "2.0", status: "ativo" },
    { id: 4, nome: "Feriado", fator: "2.0", status: "ativo" },
  ]);

  return (
    <AppShell title="Configurações" subtitle="Gerencie as diretrizes e preferências do ERP">
      <Tabs defaultValue="preferencias" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50">
          <TabsTrigger value="preferencias" className="px-6 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Settings2 className="h-4 w-4 mr-2" /> Preferências
          </TabsTrigger>
          <TabsTrigger value="minimas" className="px-6 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Database className="h-4 w-4 mr-2" /> Configurações Mínimas
          </TabsTrigger>
          <TabsTrigger value="conta" className="px-6 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <User className="h-4 w-4 mr-2" /> Minha Conta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preferencias" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="esc-card p-6">
              <h2 className="font-display font-bold text-foreground mb-1 flex items-center gap-2">
                <Sun className="h-5 w-5 text-primary" /> Aparência
              </h2>
              <p className="text-xs text-muted-foreground mb-6">Personalize o visual da sua interface.</p>

              <div className="grid grid-cols-2 gap-3">
                <OptionCard
                  active={theme === "light"}
                  onClick={() => { setTheme("light"); toast.success("Tema claro ativado"); }}
                  icon={<Sun className="h-5 w-5" />}
                  title="Modo Claro"
                  desc="Ideal para alta luminosidade"
                />
                <OptionCard
                  active={theme === "dark"}
                  onClick={() => { setTheme("dark"); toast.success("Tema escuro ativado"); }}
                  icon={<Moon className="h-5 w-5" />}
                  title="Modo Escuro"
                  desc="Conforto visual e economia"
                />
              </div>
            </section>

            <section className="esc-card p-6">
              <h2 className="font-display font-bold text-foreground mb-1 flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" /> Navegação Padrão
              </h2>
              <p className="text-xs text-muted-foreground mb-6">Escolha qual aba abrir ao acessar o painel principal.</p>

              <div className="grid grid-cols-2 gap-3">
                <OptionCard
                  active={defaultTab === "ponto"}
                  onClick={() => { setDefaultTab("ponto"); toast.success("Padrão: Ponto"); }}
                  icon={<Clock className="h-5 w-5" />}
                  title="Ponto"
                  desc="Foco em registros de pessoal"
                />
                <OptionCard
                  active={defaultTab === "operacoes"}
                  onClick={() => { setDefaultTab("operacoes"); toast.success("Padrão: Operações"); }}
                  icon={<Boxes className="h-5 w-5" />}
                  title="Operações"
                  desc="Foco em logística e volume"
                />
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="minimas" className="mt-6">
          <Tabs defaultValue="operacao" className="w-full">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <TabsList className="bg-muted p-1 h-9 rounded-lg">
                <TabsTrigger value="operacao" className="text-xs py-1 px-4">Tipos de Operação</TabsTrigger>
                <TabsTrigger value="produtos" className="text-xs py-1 px-4">Produtos</TabsTrigger>
                <TabsTrigger value="dia" className="text-xs py-1 px-4">Tipos de Dia</TabsTrigger>
                <TabsTrigger value="parametros" className="text-xs py-1 px-4">Parâmetros Básicos</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="operacao">
              <ConfigTable
                title="Tipos de Operação"
                data={tiposOperacao}
                columns={[
                  { header: "Nome", accessorKey: "nome" },
                  { header: "Código", accessorKey: "codigo", cell: (item) => <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{item.codigo}</code> },
                  {
                    header: "Status", accessorKey: "status", cell: (item) => (
                      <Badge variant={item.status === 'ativo' ? 'success' : 'secondary'} className="h-5">
                        {item.status}
                      </Badge>
                    )
                  },
                ]}
                onAdd={() => toast.info("Funcionalidade de criação em breve")}
                onEdit={(item) => toast.info(`Editando: ${item.nome}`)}
                onToggleStatus={(item) => toast.success(`${item.nome} ${item.status === 'ativo' ? 'desativado' : 'ativado'}`)}
              />
            </TabsContent>

            <TabsContent value="produtos">
              <ConfigTable
                title="Produtos / Categorias"
                data={produtos}
                columns={[
                  { header: "Categoria", accessorKey: "categoria" },
                  { header: "Alíquota ICMS", accessorKey: "icms", cell: (item) => <span className="font-bold text-primary">{item.icms}</span> },
                  {
                    header: "Status", accessorKey: "status", cell: (item) => (
                      <Badge variant={item.status === 'ativo' ? 'success' : 'secondary'} className="h-5">
                        {item.status}
                      </Badge>
                    )
                  },
                ]}
                onAdd={() => toast.info("Funcionalidade de criação em breve")}
              />
            </TabsContent>

            <TabsContent value="dia">
              <ConfigTable
                title="Tipos de Dia"
                data={tiposDia}
                columns={[
                  { header: "Descrição", accessorKey: "nome" },
                  { header: "Fator Multiplicador", accessorKey: "fator", cell: (item) => <span className="font-mono font-bold">x{item.fator}</span> },
                  {
                    header: "Status", accessorKey: "status", cell: (item) => (
                      <Badge variant={item.status === 'ativo' ? 'success' : 'secondary'} className="h-5">
                        {item.status}
                      </Badge>
                    )
                  },
                ]}
              />
            </TabsContent>

            <TabsContent value="parametros">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="esc-card p-6">
                  <h3 className="font-display font-semibold mb-4 text-foreground">Geral</h3>
                  <div className="space-y-4">
                    <ParamItem label="Moeda Padrão" value="BRL (R$)" />
                    <ParamItem label="Fuso Horário" value="GMT-3 (Brasília)" />
                    <ParamItem label="Limite de Escopo" value="31 dias" />
                  </div>
                </section>
                <section className="esc-card p-6">
                  <h3 className="font-display font-semibold mb-4 text-foreground">Operacional</h3>
                  <div className="space-y-4">
                    <ParamItem label="Tolerância de Ponto" value="10 minutos" />
                    <ParamItem label="Arredondamento Financeiro" value="Duas casas" />
                    <ParamItem label="Notificação de Inconsistência" value="Ativado" />
                  </div>
                </section>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="conta" className="mt-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="esc-card p-8 flex items-center gap-6">
              <div className="h-20 w-20 rounded-full bg-primary-soft flex items-center justify-center border-2 border-primary">
                <User className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">João Dias</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Shield className="h-4 w-4 text-success" /> Encarregado Administrativo
                </p>
                <p className="text-xs text-muted-foreground mt-4">Matrícula: <code className="bg-muted px-1.5 py-0.5 rounded">0042-X</code></p>
              </div>
            </div>

            <div className="esc-card p-6">
              <h3 className="font-display font-semibold mb-4 text-foreground">Segurança</h3>
              <Button variant="outline" className="w-full justify-start text-foreground border-border hover:bg-secondary">
                Alterar Senha de Acesso
              </Button>
              <Button variant="outline" className="w-full justify-start text-foreground border-border hover:bg-secondary mt-2">
                Configurar Autenticação em Duas Etapas (2FA)
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};

const ParamItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold text-foreground">{value}</span>
  </div>
);

const OptionCard = ({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "text-left p-4 rounded-xl border transition-all duration-200 outline-none",
      active
        ? "border-primary bg-primary-soft ring-1 ring-primary shadow-sm"
        : "border-border bg-card hover:border-primary/30 hover:bg-muted/30"
    )}
  >
    <div className={cn("mb-3 h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
      active ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
      {icon}
    </div>
    <div className="font-display font-bold text-foreground text-sm tracking-tight">{title}</div>
    <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{desc}</div>
  </button>
);

export default Configuracoes;
