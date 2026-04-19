import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const colabs = [
  { nome: "Imelda Hakim", cargo: "Operadora", contrato: "Hora", fatura: true, status: "ok" as const },
  { nome: "Hikmat Sofyan", cargo: "Operador", contrato: "Operação", fatura: true, status: "inconsistente" as const },
  { nome: "Ita Septiasari", cargo: "Conferente", contrato: "Hora", fatura: true, status: "ok" as const },
  { nome: "Hendy", cargo: "Operador", contrato: "Hora", fatura: false, status: "ajustado" as const },
  { nome: "Jainudin", cargo: "Conferente", contrato: "Hora", fatura: true, status: "incompleto" as const },
];

const Colaboradores = () => {
  return (
    <AppShell title="Colaboradores" subtitle="Cadastro e configuração de equipe">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button><Plus className="h-4 w-4 mr-1.5" /> Novo colaborador</Button>
        </div>
        <section className="esc-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="esc-table-header">
              <tr className="text-left">
                <th className="px-5 h-11 font-medium">Nome</th>
                <th className="px-3 h-11 font-medium">Cargo</th>
                <th className="px-3 h-11 font-medium text-center">Contrato</th>
                <th className="px-3 h-11 font-medium text-center">Gera faturamento</th>
                <th className="px-5 h-11 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {colabs.map((c) => (
                <tr key={c.nome} className="border-t border-muted hover:bg-background">
                  <td className="px-5 h-[52px] font-medium text-foreground">{c.nome}</td>
                  <td className="px-3 text-muted-foreground">{c.cargo}</td>
                  <td className="px-3 text-center">{c.contrato}</td>
                  <td className="px-3 text-center text-muted-foreground">{c.fatura ? "Sim" : "Não"}</td>
                  <td className="px-5 text-center"><StatusChip status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
};

export default Colaboradores;
