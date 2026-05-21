import { useQuery } from "@tanstack/react-query";
import { LogSincronizacaoService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { RefreshCw, Upload, CheckCircle2, XCircle, AlertCircle, Loader2, Info } from "lucide-react";
import { getOperationalStatus } from "@/constants/operationalStatus";
import { cn } from "@/lib/utils";

const Importacoes = () => {
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["importacoes"],
    queryFn: () => LogSincronizacaoService.getWithEmpresa(),
  });

  return (
    <AppShell title="Importações" subtitle="Histórico de sincronizações de ponto">
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Button variant="outline"><Upload className="h-4 w-4 mr-1.5" /> Importar CSV</Button>
          <Button><RefreshCw className="h-4 w-4 mr-1.5" /> Sincronizar agora</Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <section className="esc-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="esc-table-header">
                <tr className="text-left">
                  <th className="px-5 h-11 font-medium">ID</th>
                  <th className="px-3 h-11 font-medium">Data / hora</th>
                  <th className="px-3 h-11 font-medium">Origem</th>
                  <th className="px-3 h-11 font-medium">Empresa</th>
                  <th className="px-3 h-11 font-medium text-center">Registros</th>
                  <th className="px-3 h-11 font-medium text-center">Duração</th>
                  <th className="px-5 h-11 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i: any) => {
                  const statusConfig = getOperationalStatus(i.status);
                  const Icon = statusConfig.variant === 'success' ? CheckCircle2 :
                    statusConfig.variant === 'destructive' ? XCircle :
                      statusConfig.variant === 'warning' ? AlertCircle : Info;

                  return (
                    <tr key={i.id} className="border-t border-muted hover:bg-background">
                      <td className="px-5 h-[52px] font-medium text-foreground">{i.id.substring(0, 8)}</td>
                      <td className="px-3 text-muted-foreground">{new Date(i.data).toLocaleString('pt-BR')}</td>
                      <td className="px-3 text-foreground">{i.origem}</td>
                      <td className="px-3 text-muted-foreground">{i.empresas?.nome || '—'}</td>
                      <td className="px-3 text-center font-display font-medium">{i.contagem_registros}</td>
                      <td className="px-3 text-center text-muted-foreground">{i.duracao}</td>
                      <td className="px-5 text-center">
                        <span className={cn("esc-chip inline-flex items-center gap-1", statusConfig.bg, statusConfig.color)}>
                          <Icon className="h-3 w-3" /> {statusConfig.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted-foreground italic">
                      Nenhuma importação registrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </AppShell>
  );
};

export default Importacoes;
