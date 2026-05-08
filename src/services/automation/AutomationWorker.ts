/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';
import { OperationalAutomationEngine } from './OperationalAutomationEngine';

export interface WorkerConfig {
    batchSize: number;
    lockTimeoutMs: number;
    maxRetries: number;
    workerId: string;
}

const DEFAULT_CONFIG: WorkerConfig = {
    batchSize: 5,
    lockTimeoutMs: 5 * 60 * 1000, // 5 minutes
    maxRetries: 3,
    workerId: `worker-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString()}`
};

export class AutomationWorker {
    private config: WorkerConfig;
    private isRunning: boolean = false;
    private heartbeatInterval: any = null;

    constructor(config?: Partial<WorkerConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // Para uso do Frontend (abstracao) - no futuro sera ativado por trigger/cron
    public async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        // Loop de processamento
        try {
            await this.processNextBatch();
        } catch (error) {
            console.error("Erro no worker:", error);
        } finally {
            this.isRunning = false;
        }
    }

    public stop() {
        this.isRunning = false;
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    private async processNextBatch() {
        // 1. Recuperar execucoes travadas (Heartbeat Expirado)
        await this.recoverStalledExecutions();

        // 2. Buscar lote pendente
        const jobs = await this.fetchAndLockBatch();
        if (!jobs || jobs.length === 0) return;

        // 3. Processar
        for (const job of jobs) {
            if (!this.isRunning) break;
            
            // Inicia heartbeat para este job especifico ou global
            await this.executeJob(job);
        }
    }

    private async recoverStalledExecutions() {
        const lockTimeoutDate = new Date(Date.now() - this.config.lockTimeoutMs).toISOString();

        // Encontra itens executando mas com heartbeat atrasado. A limpeza completa
        // fica no motor de auto-cura; aqui mantemos apenas o recovery local do worker.
        const { data: stalled, error } = await supabase
            .from('automacao_execucoes')
            .select('id, empresa_id')
            .eq('status', 'executando')
            .lt('heartbeat_at', lockTimeoutDate);

        if (!error && stalled && stalled.length > 0) {
            const empresas = Array.from(new Set(stalled.map((job: any) => job.empresa_id).filter(Boolean)));
            for (const empresaId of empresas) {
                await OperationalAutomationEngine.limparFilaInteligente(empresaId);
            }
        }
    }

    private async fetchAndLockBatch() {
        // Num cenario real de concorrencia, usariamos 'SELECT FOR UPDATE SKIP LOCKED' via RPC.
        // Simulando abordagem basica para frontend por enquanto:
        const { data: pendentes, error } = await supabase
            .from('automacao_execucoes')
            .select('*')
            .eq('status', 'pendente')
            .order('prioridade', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(this.config.batchSize);

        if (error || !pendentes || pendentes.length === 0) return [];

        const lockedJobs = [];
        const now = new Date().toISOString();

        for (const job of pendentes) {
            // Tenta travar
            const { data, error: lockError } = await supabase
                .from('automacao_execucoes')
                .update({
                    status: 'executando',
                    locked_at: now,
                    locked_by: this.config.workerId,
                    heartbeat_at: now,
                    iniciado_em: job.iniciado_em || now,
                    tentativas: (job.tentativas || 0) + 1
                })
                .eq('id', job.id)
                .eq('status', 'pendente') // Garantir que ainda esta pendente
                .select()
                .single();

            if (!lockError && data) {
                lockedJobs.push(data);
            }
        }

        return lockedJobs;
    }

    private async executeJob(job: any) {
        const heartbeatTimer = setInterval(async () => {
            await supabase.from('automacao_execucoes')
                .update({ heartbeat_at: new Date().toISOString() })
                .eq('id', job.id);
        }, this.config.lockTimeoutMs / 2); // Atualiza heartbeat na metade do tempo de limite

        try {
            const resultado = await OperationalAutomationEngine.executarTipoAutomacao(job.tipo, job.empresa_id);

            // Concluir
            await supabase.from('automacao_execucoes').update({
                status: 'concluido',
                finalizado_em: new Date().toISOString(),
                resultado_json: resultado,
                locked_by: null,
                locked_at: null,
                heartbeat_at: null
            }).eq('id', job.id);

        } catch (err: any) {
            // Falhou
            const hasMoreRetries = job.tentativas < this.config.maxRetries;
            
            await supabase.from('automacao_execucoes').update({
                status: hasMoreRetries ? 'pendente' : 'falhou', // Se tem tentativas, volta pra pendente
                finalizado_em: hasMoreRetries ? null : new Date().toISOString(),
                erro: err.message || JSON.stringify(err),
                locked_by: null,
                locked_at: null
            }).eq('id', job.id);
            
            // Opcional: Registrar alerta de falha no motor
        } finally {
            clearInterval(heartbeatTimer);
        }
    }
}
