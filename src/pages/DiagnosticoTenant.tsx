import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type DiagResult = {
    user_id: string | null;
    user_email: string | null;
    profile_tenant_id: string | null;
    profile_role: string | null;
    profile_error: string | null;
    tenant_name: string | null;
    tenant_error: string | null;
    empresas_by_tenant: Array<{ id: string; nome: string; tenant_id: string | null }>;
    empresas_total: number;
    empresas_error: string | null;
    operacoes_by_tenant: Array<{ tenant_id: string | null; count: number }>;
    operacoes_error: string | null;
    servicos_by_tenant: Array<{ tenant_id: string | null; count: number }>;
    custos_by_fecha: Array<{ competencia: string; count: number }>;
    match_tenant_empresas: "SIM" | "NÃO" | "N/A";
    match_tenant_operacoes: "SIM" | "NÃO" | "N/A";
    empresas_sem_tenant: number;
    operacoes_sem_tenant: number;
    done: boolean;
};

const DiagnosticoTenant = () => {
    const [result, setResult] = useState<DiagResult | null>(null);
    const [running, setRunning] = useState(false);

    const runDiag = async () => {
        setRunning(true);
        const r: DiagResult = {
            user_id: null,
            user_email: null,
            profile_tenant_id: null,
            profile_role: null,
            profile_error: null,
            tenant_name: null,
            tenant_error: null,
            empresas_by_tenant: [],
            empresas_total: 0,
            empresas_error: null,
            operacoes_by_tenant: [],
            operacoes_error: null,
            servicos_by_tenant: [],
            custos_by_fecha: [],
            match_tenant_empresas: "N/A",
            match_tenant_operacoes: "N/A",
            empresas_sem_tenant: 0,
            operacoes_sem_tenant: 0,
            done: false,
        };

        try {
            // 1. Usuário atual
            const { data: { user } } = await supabase.auth.getUser();
            r.user_id = user?.id ?? null;
            r.user_email = user?.email ?? null;

            if (!user) {
                r.done = true;
                setResult({ ...r });
                return;
            }

            // 2. Profile → tenant_id
            const { data: profile, error: profErr } = await supabase
                .from("profiles")
                .select("tenant_id, role")
                .eq("user_id", user.id)
                .single();
            r.profile_tenant_id = profile?.tenant_id ?? null;
            r.profile_role = profile?.role ?? null;
            r.profile_error = profErr ? profErr.message : null;

            // 3. Tenant name
            if (profile?.tenant_id) {
                const { data: td, error: te } = await supabase
                    .from("tenants")
                    .select("id, name")
                    .eq("id", profile.tenant_id)
                    .single();
                r.tenant_name = td?.name ?? null;
                r.tenant_error = te ? te.message : null;
            }

            // 4. Empresas que esse tenant enxerga
            const { data: empAll, error: empErr } = await (supabase as any)
                .from("empresas")
                .select("id, nome, tenant_id")
                .limit(50);
            r.empresas_error = empErr ? empErr.message : null;
            r.empresas_by_tenant = empAll ?? [];
            r.empresas_total = (empAll ?? []).length;
            r.empresas_sem_tenant = (empAll ?? []).filter((e: any) => !e.tenant_id).length;

            // 5. Empresas especificamente do tenant do usuário
            const empDoTenant = (empAll ?? []).filter(
                (e: any) => e.tenant_id === profile?.tenant_id
            );

            if (profile?.tenant_id) {
                r.match_tenant_empresas = empDoTenant.length > 0 ? "SIM" : "NÃO";
            }

            // 6. Operações por tenant (agrupa)
            const { data: opAll, error: opErr } = await (supabase as any)
                .from("operacoes_producao")
                .select("tenant_id, id")
                .limit(500);
            r.operacoes_error = opErr ? opErr.message : null;

            if (opAll) {
                const grouped: Record<string, number> = {};
                for (const op of opAll) {
                    const key = op.tenant_id ?? "NULL";
                    grouped[key] = (grouped[key] ?? 0) + 1;
                }
                r.operacoes_by_tenant = Object.entries(grouped).map(([tenant_id, count]) => ({
                    tenant_id: tenant_id === "NULL" ? null : tenant_id,
                    count,
                }));
                r.operacoes_sem_tenant = opAll.filter((o: any) => !o.tenant_id).length;

                const opDoTenant = opAll.filter((o: any) => o.tenant_id === profile?.tenant_id);
                if (profile?.tenant_id) {
                    r.match_tenant_operacoes = opDoTenant.length > 0 ? "SIM" : "NÃO";
                }
            }

            // 7. Serviços extras por tenant
            const { data: seAll } = await (supabase as any)
                .from("servicos_extras_operacionais")
                .select("tenant_id, id, data")
                .limit(500);
            if (seAll) {
                const grouped: Record<string, number> = {};
                for (const s of seAll) {
                    const key = s.tenant_id ?? "NULL";
                    grouped[key] = (grouped[key] ?? 0) + 1;
                }
                r.servicos_by_tenant = Object.entries(grouped).map(([tid, count]) => ({
                    tenant_id: tid === "NULL" ? null : tid,
                    count,
                }));
            }

            // 8. Custos extras por competência (mês)
            const { data: ceAll } = await (supabase as any)
                .from("custos_extras_operacionais")
                .select("data, id")
                .limit(500);
            if (ceAll) {
                const grouped: Record<string, number> = {};
                for (const c of ceAll) {
                    const key = String(c.data ?? "").slice(0, 7) || "NULL";
                    grouped[key] = (grouped[key] ?? 0) + 1;
                }
                r.custos_by_fecha = Object.entries(grouped)
                    .map(([competencia, count]) => ({ competencia, count }))
                    .sort((a, b) => b.competencia.localeCompare(a.competencia));
            }

        } catch (e: any) {
            console.error("[DIAG] Erro geral:", e);
        }

        r.done = true;
        setResult({ ...r });
        setRunning(false);
    };

    useEffect(() => {
        runDiag();
    }, []);

    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <div style={{ marginBottom: 24, padding: 16, background: "#1a1a2e", borderRadius: 8, border: "1px solid #333" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#4FC3F7", fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>{title}</h3>
            {children}
        </div>
    );

    const Row = ({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: "ok" | "err" | "warn" }) => (
        <div style={{ display: "flex", gap: 12, padding: "4px 0", borderBottom: "1px solid #222" }}>
            <span style={{ color: "#888", minWidth: 240, fontSize: 13 }}>{label}</span>
            <span style={{
                color: highlight === "ok" ? "#69F0AE" : highlight === "err" ? "#FF5252" : highlight === "warn" ? "#FFD740" : "#fff",
                fontSize: 13, fontFamily: "monospace"
            }}>{value}</span>
        </div>
    );

    return (
        <div style={{ background: "#0d0d1a", minHeight: "100vh", padding: 32, color: "#fff", fontFamily: "Inter, sans-serif" }}>
            <h1 style={{ color: "#4FC3F7", marginBottom: 8 }}>🔍 Diagnóstico Tenant/Empresa/Operações</h1>
            <p style={{ color: "#888", marginBottom: 24, fontSize: 13 }}>Apenas leitura. Nenhuma alteração é feita.</p>

            {running && <p style={{ color: "#FFD740" }}>⏳ Executando diagnóstico...</p>}

            {result?.done && (
                <>
                    <Section title="1. Usuário Logado">
                        <Row label="user_id" value={result.user_id ?? "NULL"} highlight={result.user_id ? "ok" : "err"} />
                        <Row label="user_email" value={result.user_email ?? "NULL"} />
                    </Section>

                    <Section title="2. Profile → Tenant">
                        <Row label="profile_role" value={result.profile_role ?? "NULL"} highlight={result.profile_role ? "ok" : "warn"} />
                        <Row label="profile_tenant_id" value={result.profile_tenant_id ?? "NULL"} highlight={result.profile_tenant_id ? "ok" : "err"} />
                        <Row label="profile_error" value={result.profile_error ?? "— nenhum —"} highlight={result.profile_error ? "err" : undefined} />
                        <Row label="tenant_name" value={result.tenant_name ?? "NULL (não encontrado)"} highlight={result.tenant_name ? "ok" : "err"} />
                        <Row label="tenant_error" value={result.tenant_error ?? "— nenhum —"} highlight={result.tenant_error ? "err" : undefined} />
                    </Section>

                    <Section title="3. Empresas Visíveis pelo RLS">
                        <Row label="Total empresas retornadas" value={result.empresas_total} highlight={result.empresas_total > 0 ? "ok" : "err"} />
                        <Row label="Empresas sem tenant_id" value={result.empresas_sem_tenant} highlight={result.empresas_sem_tenant > 0 ? "warn" : undefined} />
                        <Row label="Erro na query empresas" value={result.empresas_error ?? "— nenhum —"} highlight={result.empresas_error ? "err" : undefined} />
                        <Row label="Match tenant_id empresas" value={result.match_tenant_empresas} highlight={result.match_tenant_empresas === "SIM" ? "ok" : result.match_tenant_empresas === "NÃO" ? "err" : undefined} />
                        <div style={{ marginTop: 12 }}>
                            <div style={{ color: "#888", fontSize: 12, marginBottom: 6 }}>Empresas retornadas (todas, sem filtro):</div>
                            {result.empresas_by_tenant.map((e, i) => (
                                <div key={i} style={{ fontFamily: "monospace", fontSize: 12, color: e.tenant_id === result.profile_tenant_id ? "#69F0AE" : "#FF5252", padding: "2px 0" }}>
                                    {e.nome} | id: {e.id.slice(0, 8)}... | tenant_id: {e.tenant_id ? e.tenant_id.slice(0, 8) + "..." : "NULL"}
                                    {e.tenant_id === result.profile_tenant_id ? " ✅" : " ❌ (diferente do usuário)"}
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section title="4. operacoes_producao — Agrupado por tenant_id">
                        <Row label="Erro na query" value={result.operacoes_error ?? "— nenhum —"} highlight={result.operacoes_error ? "err" : undefined} />
                        <Row label="Registros sem tenant_id" value={result.operacoes_sem_tenant} highlight={result.operacoes_sem_tenant > 0 ? "warn" : undefined} />
                        <Row label="Match tenant operações" value={result.match_tenant_operacoes} highlight={result.match_tenant_operacoes === "SIM" ? "ok" : result.match_tenant_operacoes === "NÃO" ? "err" : undefined} />
                        <div style={{ marginTop: 12 }}>
                            {result.operacoes_by_tenant.map((o, i) => (
                                <div key={i} style={{ fontFamily: "monospace", fontSize: 12, color: o.tenant_id === result.profile_tenant_id ? "#69F0AE" : "#FF5252", padding: "2px 0" }}>
                                    tenant_id: {o.tenant_id ? o.tenant_id.slice(0, 8) + "..." : "NULL"} → {o.count} registros
                                    {o.tenant_id === result.profile_tenant_id ? " ✅ (usuário atual)" : " ❌"}
                                </div>
                            ))}
                            {result.operacoes_by_tenant.length === 0 && <div style={{ color: "#FF5252", fontSize: 12 }}>Nenhuma operação retornada pelo RLS</div>}
                        </div>
                    </Section>

                    <Section title="5. servicos_extras_operacionais — Por tenant_id">
                        {result.servicos_by_tenant.map((s, i) => (
                            <div key={i} style={{ fontFamily: "monospace", fontSize: 12, color: s.tenant_id === result.profile_tenant_id ? "#69F0AE" : "#FF5252", padding: "2px 0" }}>
                                tenant_id: {s.tenant_id ? s.tenant_id.slice(0, 8) + "..." : "NULL"} → {s.count} registros
                                {s.tenant_id === result.profile_tenant_id ? " ✅" : " ❌"}
                            </div>
                        ))}
                        {result.servicos_by_tenant.length === 0 && <div style={{ color: "#FF5252", fontSize: 12 }}>Nenhum serviço retornado pelo RLS</div>}
                    </Section>

                    <Section title="6. custos_extras_operacionais — Por Competência (mês-ano)">
                        {result.custos_by_fecha.map((c, i) => (
                            <div key={i} style={{ fontFamily: "monospace", fontSize: 12, color: "#FFD740", padding: "2px 0" }}>
                                {c.competencia} → {c.count} registros
                            </div>
                        ))}
                        {result.custos_by_fecha.length === 0 && <div style={{ color: "#FF5252", fontSize: 12 }}>Nenhum custo retornado pelo RLS</div>}
                    </Section>

                    <Section title="7. Diagnóstico Final">
                        <Row
                            label="Incompatibilidade usuário ↔ empresas"
                            value={result.match_tenant_empresas === "NÃO" ? "⚠️ SIM — empresas não pertencem ao tenant do usuário" : result.match_tenant_empresas === "SIM" ? "✅ NÃO — empresas pertencem ao tenant correto" : "N/A"}
                            highlight={result.match_tenant_empresas === "NÃO" ? "err" : result.match_tenant_empresas === "SIM" ? "ok" : undefined}
                        />
                        <Row
                            label="Incompatibilidade usuário ↔ operações"
                            value={result.match_tenant_operacoes === "NÃO" ? "⚠️ SIM — operações não pertencem ao tenant do usuário" : result.match_tenant_operacoes === "SIM" ? "✅ NÃO — operações pertencem ao tenant correto" : "N/A"}
                            highlight={result.match_tenant_operacoes === "NÃO" ? "err" : result.match_tenant_operacoes === "SIM" ? "ok" : undefined}
                        />
                        {result.empresas_total === 0 && (
                            <div style={{ marginTop: 12, padding: 12, background: "#3a0000", borderRadius: 6, color: "#FF5252", fontSize: 13 }}>
                                🚨 getEmpresaIdsFromTenant() retornaria [] — causa confirmada do sumiço dos dados.
                                Possível causa: RLS na tabela "empresas" bloqueando a query sem filtro de tenant_id.
                            </div>
                        )}
                        {result.empresas_total > 0 && result.match_tenant_empresas === "NÃO" && (
                            <div style={{ marginTop: 12, padding: 12, background: "#3a1a00", borderRadius: 6, color: "#FFD740", fontSize: 13 }}>
                                ⚠️ Empresas visíveis mas pertencem a outro tenant. getEmpresaIdsFromTenant() vai retornar IDs do tenant errado — filtro vai buscar operações erradas.
                            </div>
                        )}
                        {result.match_tenant_empresas === "SIM" && result.match_tenant_operacoes === "NÃO" && (
                            <div style={{ marginTop: 12, padding: 12, background: "#3a1a00", borderRadius: 6, color: "#FFD740", fontSize: 13 }}>
                                ⚠️ Empresas OK mas operações têm tenant diferente. As operações foram salvas com tenant_id divergente do tenant atual.
                            </div>
                        )}
                        {result.match_tenant_empresas === "SIM" && result.match_tenant_operacoes === "SIM" && (
                            <div style={{ marginTop: 12, padding: 12, background: "#003a00", borderRadius: 6, color: "#69F0AE", fontSize: 13 }}>
                                ✅ Tenant, empresas e operações estão consistentes. O problema deve ser no filtro de data/mês nas telas de recepção.
                            </div>
                        )}
                    </Section>

                    <button
                        onClick={runDiag}
                        style={{ marginTop: 16, padding: "10px 24px", background: "#4FC3F7", color: "#000", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}
                    >
                        🔄 Executar Novamente
                    </button>
                </>
            )}
        </div>
    );
};

export default DiagnosticoTenant;
