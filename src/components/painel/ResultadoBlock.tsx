import { Wallet, TrendingUp } from "lucide-react";

const colaboradores = [
  { nome: "Imelda Hakim", base: "Hora", calc: "8h08 × R$ 22,00", valor: "R$ 178,93" },
  { nome: "Ita Septiasari", base: "Hora", calc: "9h30 × R$ 22,00", valor: "R$ 209,00" },
  { nome: "Ahmad Indrawan", base: "Hora", calc: "7h20 × R$ 22,00", valor: "R$ 161,33" },
  { nome: "Joko Joko", base: "Hora", calc: "8h12 × R$ 22,00", valor: "R$ 180,40" },
];

const operacoes = [
  { id: "OP-1041", calc: "320 vol × R$ 4,00", valor: "R$ 1.280,00" },
  { id: "OP-1043", calc: "180 vol × R$ 4,00", valor: "R$ 720,00" },
  { id: "OP-1044", calc: "2 carros × R$ 230,00", valor: "R$ 460,00" },
];

export const ResultadoBlock = () => {
  return (
    <section className="esc-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-foreground">Resultado financeiro</h2>
          <span className="esc-chip bg-info-soft text-info ml-1">Tempo real</span>
        </div>
        <div className="text-xs text-muted-foreground">Atualizado agora</div>
      </header>

      <div className="grid grid-cols-2 divide-x divide-border">
        {/* Por colaborador */}
        <div className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">Por colaborador (hora)</div>
          <ul className="space-y-2.5">
            {colaboradores.map((c) => (
              <li key={c.nome} className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-foreground">{c.nome}</div>
                  <div className="text-xs text-muted-foreground">{c.calc}</div>
                </div>
                <div className="font-display font-semibold text-foreground">{c.valor}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* Por operação */}
        <div className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">Por operação (serviço)</div>
          <ul className="space-y-2.5">
            {operacoes.map((o) => (
              <li key={o.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-foreground">{o.id}</div>
                  <div className="text-xs text-muted-foreground">{o.calc}</div>
                </div>
                <div className="font-display font-semibold text-foreground">{o.valor}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="border-t border-border bg-background/50 px-5 py-4 grid grid-cols-3 gap-4">
        <Total label="Total colaboradores" value="R$ 729,66" />
        <Total label="Total operações" value="R$ 2.460,00" />
        <Total label="Total do dia" value="R$ 3.189,66" highlight />
      </footer>
    </section>
  );
};

const Total = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
      {highlight && <TrendingUp className="h-3 w-3 text-primary" />}
      {label}
    </div>
    <div className={`mt-1 font-display font-bold text-[20px] ${highlight ? "text-primary" : "text-foreground"}`}>
      {value}
    </div>
  </div>
);
