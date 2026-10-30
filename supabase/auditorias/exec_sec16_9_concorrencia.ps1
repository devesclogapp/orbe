<#
.SYNOPSIS
  Executor de Teste Real de Concorrencia Multissessao - SEC-16.9 (FIX 11K).
.DESCRIPTION
  Dispara duas conexoes PostgreSQL independentes e simultaneas em um banco de dados
  efemero transiente dentro do container Docker local 'supabase_db_sec02_hml'.
  
  Garantias de Engenharia e Isolamento Estrito:
    1. Verificacao previa de isolamento fisico e catalogo anti-producao.
    2. Identificacao inequivoca da execucao via token deterministico unico.
    3. Verificacao de conexoes ativas no banco template antes da clonagem (sem encerrar sessoes reais).
    4. Protecao rigida contra exclusao acidental de banco principal ou preexistente (regex de seguranca).
    5. Comprovacao observavel em tempo real de espera de lock via pg_stat_activity e pg_blocking_pids.
    6. Verificacao posterior ao DROP DATABASE por consulta direta a pg_database (FAIL e ExitCode 1 se persistir).
    7. Limpeza estrita em bloco finally sem violar imutabilidade de convites aceitos.
    8. Preservacao integral de logs (stdout/stderr) e codificacao 100% ASCII para PowerShell 5.1.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\supabase\auditorias\exec_sec16_9_concorrencia.ps1
#>

[CmdletBinding()]
param ()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ==============================================================================
# CONSTANTES RIGIDAS DE ISOLAMENTO (IMUTAVEIS)
# ==============================================================================
$TARGET_CONTAINER   = "supabase_db_sec02_hml"
$TEMPLATE_DB        = "template1"
$TARGET_USER        = "postgres"
$EXPECTED_IMAGE_TAG = "supabase/postgres"

# Identificacao inequivoca da execucao: prefixo fixo seguro + timestamp curto + hex aleatorio
$EXEC_RUN_ID        = "sec169_" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + "_" + (Get-Random -Minimum 1000 -Maximum 9999)
$TRANSIENT_DB       = "db_transient_$EXEC_RUN_ID"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " ERP ORBE - SEC-02 | TESTE DE CONCORRENCIA MULTISSESSAO (SEC-16.9)" -ForegroundColor Cyan
Write-Host " Target Container: $TARGET_CONTAINER" -ForegroundColor Cyan
Write-Host " Template DB:      $TEMPLATE_DB (Isolamento via template1 limpo)" -ForegroundColor Cyan
Write-Host " Transient DB:     $TRANSIENT_DB (Isolamento Efemero FIX 11L.1)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# Helper seguro para invocacao de comandos Docker
function Invoke-DockerCmd {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Arguments
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker"
    $psi.Arguments = $Arguments
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    if ($null -eq $proc) {
        throw "FATAL / FAIL-CLOSED: Nao foi possivel iniciar processo 'docker $Arguments'!"
    }

    $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
    $stderrTask = $proc.StandardError.ReadToEndAsync()

    $proc.WaitForExit()
    [System.Threading.Tasks.Task]::WaitAll($stdoutTask, $stderrTask)

    return [PSCustomObject]@{
        ExitCode = $proc.ExitCode
        Stdout   = $stdoutTask.Result
        Stderr   = $stderrTask.Result
    }
}

# Helper assincrono para despachar psql com streaming de arquivo SQL no banco efemero
function Start-PsqlProcess {
    param (
        [Parameter(Mandatory = $true)]
        [string]$SqlFilePath,
        [Parameter(Mandatory = $false)]
        [string]$Database = $TRANSIENT_DB
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker"
    $psi.Arguments = "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $Database"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    if ($null -eq $proc) {
        throw "FATAL / FAIL-CLOSED: Nao foi possivel iniciar sessao de concorrencia!"
    }

    $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
    $stderrTask = $proc.StandardError.ReadToEndAsync()

    $sqlBytes = [System.IO.File]::ReadAllBytes($SqlFilePath)
    $rawStream = $proc.StandardInput.BaseStream
    $rawStream.Write($sqlBytes, 0, $sqlBytes.Length)
    $rawStream.Flush()
    $rawStream.Close()

    return [PSCustomObject]@{
        Process    = $proc
        StdoutTask = $stdoutTask
        StderrTask = $stderrTask
        File       = $SqlFilePath
    }
}

function Wait-PsqlProcess {
    param (
        [Parameter(Mandatory = $true)]
        $ProcHandle,
        [Parameter(Mandatory = $true)]
        [string]$SessionName,
        [int]$TimeoutSeconds = 15
    )

    $exited = $ProcHandle.Process.WaitForExit($TimeoutSeconds * 1000)
    if (-not $exited) {
        try { $ProcHandle.Process.Kill() } catch {}
        throw "FATAL / TIMEOUT: Sessao $SessionName excedeu o tempo limite de $TimeoutSeconds segundos (possivel deadlock nao resolvido)!"
    }

    [System.Threading.Tasks.Task]::WaitAll($ProcHandle.StdoutTask, $ProcHandle.StderrTask)

    $exitCode = $ProcHandle.Process.ExitCode
    $stdoutStr = $ProcHandle.StdoutTask.Result
    $stderrStr = $ProcHandle.StderrTask.Result

    if (-not [string]::IsNullOrWhiteSpace($stdoutStr)) {
        Write-Host "[$SessionName STDOUT]" -ForegroundColor DarkCyan
        Write-Host $stdoutStr.TrimEnd()
    }

    if (-not [string]::IsNullOrWhiteSpace($stderrStr)) {
        Write-Host "[$SessionName STDERR/NOTICES]" -ForegroundColor DarkYellow
        Write-Host $stderrStr.TrimEnd()
    }

    if ($exitCode -ne 0) {
        throw "FATAL: Sessao $SessionName falhou com ExitCode $exitCode!"
    }
}

# Helper seguro para execucao de SQL via STDIN direto (sem passagem por linha de comando)
function Invoke-PsqlStdin {
    param (
        [Parameter(Mandatory = $true)]
        [string]$SqlText,
        [Parameter(Mandatory = $false)]
        [string]$Database = $TRANSIENT_DB,
        [Parameter(Mandatory = $false)]
        [string]$SessionName = "PSQL_STDIN",
        [int]$TimeoutSeconds = 15
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker"
    $psi.Arguments = "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $Database"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    if ($null -eq $proc) {
        throw "FATAL / FAIL-CLOSED: Nao foi possivel iniciar sessao psql via stdin para $SessionName!"
    }

    $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
    $stderrTask = $proc.StandardError.ReadToEndAsync()

    # Transmissao segura via stdin em bytes UTF-8 sem BOM
    $rawBytes = [System.Text.Encoding]::UTF8.GetBytes($SqlText)
    $proc.StandardInput.BaseStream.Write($rawBytes, 0, $rawBytes.Length)
    $proc.StandardInput.BaseStream.Flush()
    $proc.StandardInput.BaseStream.Close()

    $exited = $proc.WaitForExit($TimeoutSeconds * 1000)
    if (-not $exited) {
        try { $proc.Kill() } catch {}
        throw "FATAL / TIMEOUT: Sessao $SessionName excedeu o tempo limite de $TimeoutSeconds segundos!"
    }

    [System.Threading.Tasks.Task]::WaitAll($stdoutTask, $stderrTask)

    $exitCode = $proc.ExitCode
    $stdoutStr = $stdoutTask.Result
    $stderrStr = $stderrTask.Result

    if (-not [string]::IsNullOrWhiteSpace($stdoutStr)) {
        Write-Host "[$SessionName STDOUT]" -ForegroundColor DarkCyan
        Write-Host $stdoutStr.TrimEnd()
    }

    if (-not [string]::IsNullOrWhiteSpace($stderrStr)) {
        Write-Host "[$SessionName STDERR/NOTICES]" -ForegroundColor DarkYellow
        Write-Host $stderrStr.TrimEnd()
    }

    if ($exitCode -ne 0) {
        throw "FATAL / PROVISION FAIL: Sessao $SessionName falhou com ExitCode $exitCode - $($stderrStr.Trim())"
    }

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Stdout   = $stdoutStr
        Stderr   = $stderrStr
    }
}

# Verificacao observavel de bloqueio real no catalogo do PostgreSQL dentro do banco efemero
function Assert-LockContentionObserved {
    param (
        [Parameter(Mandatory = $true)]
        [string]$BlockingAppName,
        [Parameter(Mandatory = $true)]
        [string]$BlockedAppName,
        [string]$Database = $TRANSIENT_DB,
        [int]$MaxAttempts = 15,
        [int]$IntervalMs = 200
    )

    $lockObserved = $false
    $details = ""

    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        Start-Sleep -Milliseconds $IntervalMs
        
        $lockQuery = @"
SELECT 
  blocked.pid || '|' || COALESCE(blocked.wait_event_type, '') || '|' || COALESCE(blocked.wait_event, '') || '|' || blocking.pid
FROM pg_stat_activity blocked
CROSS JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS blk_pid
JOIN pg_stat_activity blocking ON blocking.pid = blk_pid
WHERE blocked.application_name = '$BlockedAppName' 
  AND blocking.application_name = '$BlockingAppName'
  AND blocked.datname = '$Database';
"@
        $res = Invoke-DockerCmd -Arguments "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $Database -t -A -c `"$lockQuery`""
        if ($res.ExitCode -ne 0) {
            $errDetail = if (-not [string]::IsNullOrWhiteSpace($res.Stderr)) { $res.Stderr.Trim() } else { "ExitCode $($res.ExitCode)" }
            throw "FATAL / OBSERVABILITY QUERY FAIL: Falha ao consultar catalogo de locks em '$Database' (ExitCode: $($res.ExitCode)): $errDetail"
        }

        $output = $res.Stdout.Trim()
        if (-not [string]::IsNullOrWhiteSpace($output)) {
            $lockObserved = $true
            $details = $output
            break
        }
    }

    if (-not $lockObserved) {
        throw "FATAL / ASSERTION FAIL: Bloqueio concorrente NAO observado em pg_stat_activity/pg_blocking_pids! A sessao $BlockedAppName nao entrou em estado de espera pelo lock da sessao $BlockingAppName no banco $Database."
    }

    $parts = $details.Split('|')
    Write-Host " [OBSERVACAO COMPROVADA] Lock ativo no catalogo PostgreSQL (Banco: $Database):" -ForegroundColor Green
    Write-Host "   Sessao Bloqueada (PID $($parts[0])): WaitEvent=$($parts[1])/$($parts[2])" -ForegroundColor Gray
    Write-Host "   Sessao Bloqueadora (PID $($parts[3])): Lock exclusivo retido com sucesso." -ForegroundColor Gray
}

# Referencias de controle de ciclo de vida e tratamento de erros (Maquina de Estados FIX 11K.2)
# Estados permitidos: NOT_STARTED -> CREATE_UNCERTAIN -> CREATED_CONFIRMED -> DROPPED_CONFIRMED
$activeProcesses       = @()
$executionError        = $null
$cleanupError          = $null
$transientDbState      = "NOT_STARTED"
$targetContainerFullId = $null

try {
    # --------------------------------------------------------------------------
    # 1. VERIFICACAO DO DOCKER CLI E DAEMON
    # --------------------------------------------------------------------------
    Write-Host "[1/6] Verificando Docker CLI e status do Docker daemon..." -NoNewline
    try {
        $null = Get-Command docker -ErrorAction Stop
    } catch {
        Write-Host " [FALHA]" -ForegroundColor Red
        throw "FATAL / FAIL-CLOSED: O comando 'docker' nao esta disponivel no PATH do sistema!"
    }

    $infoResult = Invoke-DockerCmd -Arguments "info"
    if ($infoResult.ExitCode -ne 0) {
        Write-Host " [FALHA]" -ForegroundColor Red
        throw "FATAL / FAIL-CLOSED: O Docker daemon nao esta operacional!"
    }
    Write-Host " [OK]" -ForegroundColor Green

    # --------------------------------------------------------------------------
    # 2. VALIDACAO FISICA DO CONTAINER supabase_db_sec02_hml
    # --------------------------------------------------------------------------
    Write-Host "[2/6] Validando identidade, ID SHA256, imagem e estado do container $TARGET_CONTAINER..." -NoNewline
    $inspectResult = Invoke-DockerCmd -Arguments "inspect $TARGET_CONTAINER"
    if ($inspectResult.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($inspectResult.Stdout)) {
        Write-Host " [FALHA]" -ForegroundColor Red
        throw "FATAL / FAIL-CLOSED: Container '$TARGET_CONTAINER' nao encontrado no Docker local!"
    }

    $containerObj = ($inspectResult.Stdout | ConvertFrom-Json)[0]
    if ($containerObj.State.Running -ne $true -or $containerObj.Name -ne "/$TARGET_CONTAINER") {
        Write-Host " [FALHA]" -ForegroundColor Red
        throw "FATAL / FAIL-CLOSED: Container '$TARGET_CONTAINER' nao esta em execucao ou nome divergente!"
    }
    $targetContainerFullId = $containerObj.Id
    Write-Host " [OK] ($($containerObj.Id.Substring(0, 12)) | Status: Running)" -ForegroundColor Green

    # --------------------------------------------------------------------------
    # 3. VALIDACAO DE CONECTIVIDADE INTERNA E VERIFICACAO DE CONEXOES ATIVAS NO TEMPLATE
    # --------------------------------------------------------------------------
    Write-Host "[3/6] Validando conectividade e inspecionando sessoes ativas no template '$TEMPLATE_DB'..." -NoNewline
    $connQuery = @"
SELECT 
  current_database() || '|' || 
  COALESCE(inet_server_addr()::text, 'SOCKET_UNIX') || '|' ||
  (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '$TEMPLATE_DB' AND pid <> pg_backend_pid());
"@
    $connResult = Invoke-DockerCmd -Arguments "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $TEMPLATE_DB -t -A -c `"$connQuery`""
    if ($connResult.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($connResult.Stdout)) {
        Write-Host " [FALHA]" -ForegroundColor Red
        throw "FATAL / FAIL-CLOSED: Falha de conectividade interna ao banco '$TEMPLATE_DB'!"
    }

    $connParts = $connResult.Stdout.Trim().Split('|')
    if ($connParts.Length -lt 3 -or $connParts[0] -ne $TEMPLATE_DB) {
        Write-Host " [FALHA]" -ForegroundColor Red
        throw "FATAL / FAIL-CLOSED: Resposta inesperada de conectividade: $($connResult.Stdout.Trim())"
    }

    $otherConnectionsCount = [int]$connParts[2]
    if ($otherConnectionsCount -gt 0) {
        Write-Host " [FALHA]" -ForegroundColor Red
        throw "FATAL / FAIL-CLOSED: O banco template '$TEMPLATE_DB' possui $otherConnectionsCount sessao(oes) externa(s) ativa(s). Clonagem por TEMPLATE rejeitada sem matar sessoes indiscriminadamente."
    }
    Write-Host " [OK] (DB: $TEMPLATE_DB | Sessoes concorrentes ativas no template: 0)" -ForegroundColor Green

    # --------------------------------------------------------------------------
    # 4. VALIDACAO ESTRITA DO CATALOGO ANTI-PRODUCAO
    # --------------------------------------------------------------------------
    Write-Host "[4/6] Inspecionando catalogo para garantia absoluta anti-producao..." -NoNewline
    $checkErpSql = "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('colaboradores', 'empresas', 'operacoes', 'lancamentos_diaristas', 'registros_ponto', 'clientes', 'fornecedores', 'transportadoras', 'veiculos', 'regras_operacionais'));"
    $erpResultObj = Invoke-DockerCmd -Arguments "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $TEMPLATE_DB -t -A -c `"$checkErpSql`""
    if ($erpResultObj.Stdout.Trim() -ne "f") {
        Write-Host " [FALHA CRITICA]" -ForegroundColor Red
        throw "FATAL / FAIL-CLOSED: Tabelas operacionais reais do ERP detectadas! Abortando imediatamente."
    }
    Write-Host " [OK] (Resultado: 'f' - Zero tabelas operacionais reais)" -ForegroundColor Green

    # --------------------------------------------------------------------------
    # 5. RESOLUCAO DOS ARQUIVOS SQL DE CONCORRENCIA E PROVISIONAMENTO
    # --------------------------------------------------------------------------
    $workspaceRoot = (Get-Location).Path
    $fileScript00  = Join-Path $workspaceRoot "supabase/auditorias/sec_02_script_00_schema_minimo_local.sql"
    $fileScript00b = Join-Path $workspaceRoot "supabase/auditorias/sec_02_script_00b_audit_log_local.sql"
    $fileMigration = Join-Path $workspaceRoot "supabase/migrations/20261025110000_sec_02_hardening_profiles_multitenant.sql"
    $fileSetup     = Join-Path $workspaceRoot "supabase/auditorias/sec_02_script_16_9_setup.sql"
    $fileC1S1      = Join-Path $workspaceRoot "supabase/auditorias/sec_02_script_16_9_cenario1_s1.sql"
    $fileC1S2      = Join-Path $workspaceRoot "supabase/auditorias/sec_02_script_16_9_cenario1_s2.sql"
    $fileC2S1      = Join-Path $workspaceRoot "supabase/auditorias/sec_02_script_16_9_cenario2_s1.sql"
    $fileC2S2      = Join-Path $workspaceRoot "supabase/auditorias/sec_02_script_16_9_cenario2_s2.sql"
    $fileValidacao = Join-Path $workspaceRoot "supabase/auditorias/sec_02_script_16_9_validacao.sql"

    $allFiles = @($fileScript00, $fileScript00b, $fileMigration, $fileSetup, $fileC1S1, $fileC1S2, $fileC2S1, $fileC2S2, $fileValidacao)
    foreach ($f in $allFiles) {
        if (-not (Test-Path $f)) {
            throw "FATAL / FAIL-CLOSED: Arquivo SQL obrigatorio nao encontrado: $f"
        }
    }

    # --------------------------------------------------------------------------
    # 6. CRIACAO DO BANCO DE DADOS EFEMERO TRANSIENTE VIA TEMPLATE1 (FIX 11L.1)
    # --------------------------------------------------------------------------
    Write-Host "[6/6] Provisionando banco de dados efemero isolado '$TRANSIENT_DB' via '$TEMPLATE_DB'..." -NoNewline

    # Validacao de seguranca do nome do banco efemero (impede injecao ou exclusao indevida)
    if ($TRANSIENT_DB -notmatch '^db_transient_sec169_\d+_\d+$' -or $TRANSIENT_DB -ne "db_transient_$EXEC_RUN_ID" -or $TRANSIENT_DB -eq $TEMPLATE_DB -or $TRANSIENT_DB -eq "postgres") {
        throw "FATAL / FAIL-CLOSED: Nome de banco efemero fora do padrao estrito de seguranca ou nao corresponde a execucao atual: '$TRANSIENT_DB'!"
    }

    # Protecao contra colisao: verificar que o banco nao existe previamente
    $dbExistsCheck = "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$TRANSIENT_DB');"
    $existsRes = Invoke-DockerCmd -Arguments "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $TEMPLATE_DB -t -A -c `"$dbExistsCheck`""
    if ($existsRes.ExitCode -ne 0 -or $existsRes.Stdout.Trim() -ne "f") {
        throw "FATAL / FAIL-CLOSED: Banco '$TRANSIENT_DB' ja existe no container ou consulta falhou! Abortando para prevencao contra colisao."
    }

    # Transicao de estado: CREATE DATABASE prestes a ser despachado, resultado e propriedade ainda incertos
    $transientDbState = "CREATE_UNCERTAIN"

    # Criar banco transiente a partir de template1 (sem clonar nem depender de conexoes em 'postgres')
    $createDbCmd = "CREATE DATABASE $TRANSIENT_DB TEMPLATE $TEMPLATE_DB;"
    $createRes = Invoke-DockerCmd -Arguments "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $TEMPLATE_DB -t -A -c `"$createDbCmd`""
    if ($createRes.ExitCode -ne 0) {
        throw "FATAL / CREATE DATABASE FAIL: Falha ao criar banco transiente '$TRANSIENT_DB' a partir de '$TEMPLATE_DB': $($createRes.Stderr.Trim())"
    }

    # Confirmacao estrita de que o banco temporario foi de fato criado no catalogo pg_database
    $verifyCreateQuery = "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$TRANSIENT_DB');"
    $verifyCreateRes = Invoke-DockerCmd -Arguments "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $TEMPLATE_DB -t -A -c `"$verifyCreateQuery`""
    if ($verifyCreateRes.ExitCode -ne 0) {
        throw "FATAL / FAIL-CLOSED: Falha na consulta de confirmacao em pg_database para '$TRANSIENT_DB' (ExitCode: $($verifyCreateRes.ExitCode))!"
    }
    if ($verifyCreateRes.Stdout.Trim() -ne "t") {
        throw "FATAL / FAIL-CLOSED: Falha de confirmacao: banco '$TRANSIENT_DB' nao foi localizado no catalogo pg_database apos o comando CREATE!"
    }

    # Transicao para CREATED_CONFIRMED exclusivamente apos confirmacao de criacao bem-sucedida pela execucao atual
    $transientDbState = "CREATED_CONFIRMED"
    Write-Host " [OK] (Estado: CREATED_CONFIRMED confirmado no catalogo pg_database)" -ForegroundColor Green

    # --------------------------------------------------------------------------
    # PROVISIONAMENTO SEQUENCIAL E OBRIGATORIO NO BANCO EFEMERO (FIX 11L.1)
    # --------------------------------------------------------------------------
    Write-Host "`n------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host " PROVISIONANDO SCHEMA BASE, AUDIT_LOG E HARDENING SEC-02 EM '$TRANSIENT_DB'..." -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan

    # 1. Infraestrutura base de autenticacao e extensoes no banco efemero via STDIN (FIX 11L.2)
    Write-Host " [Provisionamento 1/4] Inicializando extensoes e schema auth em '$TRANSIENT_DB' via STDIN..." -ForegroundColor Yellow
    $initAuthSql = @'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255),
  aud VARCHAR(255) DEFAULT 'authenticated',
  role VARCHAR(255) DEFAULT 'authenticated',
  raw_user_meta_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID 
LANGUAGE sql 
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT 
LANGUAGE sql 
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text;
$$;

-- Privilegios estritos minimos para a homologacao local
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT ON TABLE auth.users TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
'@
    $null = Invoke-PsqlStdin -SqlText $initAuthSql -Database $TRANSIENT_DB -SessionName "PROVISION_AUTH_BASE"
    Write-Host " [OK] Infraestrutura Auth inicializada com sucesso em '$TRANSIENT_DB'!" -ForegroundColor Green

    # 2. Script 00 - Schema Minimo Local
    Write-Host " [Provisionamento 2/4] Aplicando Script 00 (Schema Minimo Local) em '$TRANSIENT_DB'..." -ForegroundColor Yellow
    $hScript00 = Start-PsqlProcess -SqlFilePath $fileScript00 -Database $TRANSIENT_DB
    Wait-PsqlProcess -ProcHandle $hScript00 -SessionName "PROVISION_SCRIPT_00"

    # 3. Script 00b - Audit Log Local
    Write-Host " [Provisionamento 3/4] Aplicando Script 00b (Audit Log Local) em '$TRANSIENT_DB'..." -ForegroundColor Yellow
    $hScript00b = Start-PsqlProcess -SqlFilePath $fileScript00b -Database $TRANSIENT_DB
    Wait-PsqlProcess -ProcHandle $hScript00b -SessionName "PROVISION_SCRIPT_00B"

    # 4. Migration 02 - Hardening SEC-02
    Write-Host " [Provisionamento 4/4] Aplicando Migration SEC-02 (Hardening Profiles Multitenant) em '$TRANSIENT_DB'..." -ForegroundColor Yellow
    $hMigration = Start-PsqlProcess -SqlFilePath $fileMigration -Database $TRANSIENT_DB
    Wait-PsqlProcess -ProcHandle $hMigration -SessionName "PROVISION_MIGRATION_SEC02"
    Write-Host " [OK] Provisionamento completo do Schema SEC-02 concluido com sucesso em '$TRANSIENT_DB'!" -ForegroundColor Green

    # --------------------------------------------------------------------------
    # ETAPA A: SETUP DOS DADOS DE CONCORRENCIA NO BANCO TRANSIENTE
    # --------------------------------------------------------------------------
    Write-Host "`n------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host " ETAPA A: PROVISIONANDO MASSA DE CONCORRENCIA EM '$TRANSIENT_DB'..." -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan

    $hSetup = Start-PsqlProcess -SqlFilePath $fileSetup -Database $TRANSIENT_DB
    Wait-PsqlProcess -ProcHandle $hSetup -SessionName "SETUP_TRANSIENT"

    # --------------------------------------------------------------------------
    # ETAPA B: CENARIO 1 CONCORRENTE (EXCLUSAO VENCE VS ACEITE BLOQUEADO)
    # --------------------------------------------------------------------------
    Write-Host "`n------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host " ETAPA B: CENARIO 1 - CONCORRENCIA MULTISSESSAO (EXCLUSAO VENCE)" -ForegroundColor Cyan
    Write-Host " Disparando Sessao 1 (Admin/Exclusao) e Sessao 2 (Convidado/Aceite)..." -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan

    # Disparar Sessao 1 (Admin retem lock FOR UPDATE)
    $hC1S1 = Start-PsqlProcess -SqlFilePath $fileC1S1 -Database $TRANSIENT_DB
    $activeProcesses += $hC1S1.Process

    # Disparar Sessao 2 (Convidado tenta concorrentemente e bloqueia na tupla)
    $hC1S2 = Start-PsqlProcess -SqlFilePath $fileC1S2 -Database $TRANSIENT_DB
    $activeProcesses += $hC1S2.Process

    # Comprovar observabilidade em tempo real de lock no catalogo PostgreSQL
    Assert-LockContentionObserved -BlockingAppName "sec16_9_s1" -BlockedAppName "sec16_9_s2" -Database $TRANSIENT_DB

    # Aguardar conclusao deterministica de ambas as sessoes
    Wait-PsqlProcess -ProcHandle $hC1S1 -SessionName "CENARIO_1_SESSAO_1"
    Wait-PsqlProcess -ProcHandle $hC1S2 -SessionName "CENARIO_1_SESSAO_2"
    Write-Host " [OK] Cenario 1 Homologado com Sucesso no Banco Efemero!" -ForegroundColor Green

    # --------------------------------------------------------------------------
    # ETAPA C: CENARIO 2 CONCORRENTE (ACEITE VENCE VS EXCLUSAO BLOQUEADA)
    # --------------------------------------------------------------------------
    Write-Host "`n------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host " ETAPA C: CENARIO 2 - CONCORRENCIA MULTISSESSAO (ACEITE VENCE)" -ForegroundColor Cyan
    Write-Host " Disparando Sessao 1 (Convidado/Aceite) e Sessao 2 (Admin/Exclusao)..." -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan

    # Disparar Sessao 1 (Convidado retem lock FOR UPDATE e transiciona para aceito)
    $hC2S1 = Start-PsqlProcess -SqlFilePath $fileC2S1 -Database $TRANSIENT_DB
    $activeProcesses += $hC2S1.Process

    # Disparar Sessao 2 (Admin tenta excluir concorrentemente e bloqueia na tupla)
    $hC2S2 = Start-PsqlProcess -SqlFilePath $fileC2S2 -Database $TRANSIENT_DB
    $activeProcesses += $hC2S2.Process

    # Comprovar observabilidade em tempo real de lock no catalogo PostgreSQL
    Assert-LockContentionObserved -BlockingAppName "sec16_9_s1" -BlockedAppName "sec16_9_s2" -Database $TRANSIENT_DB

    # Aguardar conclusao deterministica de ambas as sessoes
    Wait-PsqlProcess -ProcHandle $hC2S1 -SessionName "CENARIO_2_SESSAO_1"
    Wait-PsqlProcess -ProcHandle $hC2S2 -SessionName "CENARIO_2_SESSAO_2"
    Write-Host " [OK] Cenario 2 Homologado com Sucesso no Banco Efemero!" -ForegroundColor Green

    # --------------------------------------------------------------------------
    # ETAPA D: VALIDACAO DE INTEGRIDADE RELACIONAL NO BANCO TRANSIENTE
    # --------------------------------------------------------------------------
    Write-Host "`n------------------------------------------------------------------" -ForegroundColor Cyan
    Write-Host " ETAPA D: AUDITANDO INTEGRIDADE RELACIONAL DAS TABELAS EM '$TRANSIENT_DB'..." -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------------" -ForegroundColor Cyan

    $hValidacao = Start-PsqlProcess -SqlFilePath $fileValidacao -Database $TRANSIENT_DB
    Wait-PsqlProcess -ProcHandle $hValidacao -SessionName "VALIDACAO_INTEGRIDADE"
    Write-Host " [OK] Integridade Relacional e Auditoria Aprovadas!" -ForegroundColor Green

} catch {
    $executionError = $_
    Write-Host "`n [ERRO NA PREPARACAO OU EXECUCAO] $_" -ForegroundColor Red
} finally {
    # --------------------------------------------------------------------------
    # GARANTIA ABSOLUTA DE ENCERRAMENTO E DESCARTE COMPLETO DO BANCO EFEMERO
    # --------------------------------------------------------------------------
    Write-Host "`n------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host " FINALIZANDO: GERENCIAMENTO DE DESCARTE VIA MAQUINA DE ESTADOS..." -ForegroundColor DarkGray
    Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray

    # 1. Encerrar processos clientes remanescentes do teste
    foreach ($p in $activeProcesses) {
        if ($null -ne $p -and -not $p.HasExited) {
            try { $p.Kill() } catch {}
        }
    }

    # 2. Descarte do banco efemero gerenciado pela maquina de estados explicita
    Write-Host " Estado do ciclo de vida do banco transiente: $transientDbState" -ForegroundColor DarkGray

    switch ($transientDbState) {
        "NOT_STARTED" {
            Write-Host " [INFO] Criacao do banco nao foi iniciada (NOT_STARTED). DROP DATABASE suprimido com seguranca." -ForegroundColor DarkGray
        }

        "CREATE_UNCERTAIN" {
            # O estado CREATE_UNCERTAIN deve produzir FAIL e ExitCode nao zero.
            # Nao execute DROP automaticamente quando a propriedade nao puder ser demonstrada.
            # Registre o nome exato do banco para reconciliacao manual posterior.
            $uncertainMsg = "ALERTA CRITICO / RECONCILIACAO MANUAL: O banco transiente entrou no estado 'CREATE_UNCERTAIN'. O comando CREATE DATABASE foi despachado, mas o resultado ou a confirmacao de propriedade falhou. DROP automatico foi SUPRIMIDO para evitar destruicao indevida. Identificador exato do banco para inspecao/reconciliacao manual: '$TRANSIENT_DB' no container '$TARGET_CONTAINER'."
            $cleanupError = $uncertainMsg
            Write-Host "`n [ESTADO: CREATE_UNCERTAIN] $uncertainMsg" -ForegroundColor Yellow
        }

        "CREATED_CONFIRMED" {
            try {
                # Revalidacao rigorosa da identidade do container imediatamente antes do DROP
                Write-Host " Revalidando container '$TARGET_CONTAINER' e identidade do banco antes do descarte..." -ForegroundColor DarkGray
                $recheckInspect = Invoke-DockerCmd -Arguments "inspect $TARGET_CONTAINER"
                if ($recheckInspect.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($recheckInspect.Stdout)) {
                    throw "FATAL / REVALIDATION FAIL: Falha ao inspecionar container '$TARGET_CONTAINER' imediatamente antes do DROP!"
                }
                $recheckObj = ($recheckInspect.Stdout | ConvertFrom-Json)[0]
                if ($recheckObj.State.Running -ne $true -or $recheckObj.Name -ne "/$TARGET_CONTAINER" -or $recheckObj.Id -ne $targetContainerFullId) {
                    throw "FATAL / REVALIDATION FAIL: Container alvo '$TARGET_CONTAINER' nao esta em execucao ou teve ID SHA256 alterado antes do DROP (Esperado: $targetContainerFullId | Atual: $($recheckObj.Id))!"
                }

                # Revalidacao rigorosa da identidade do banco efemero imediatamente antes do DROP
                if ($TRANSIENT_DB -notmatch '^db_transient_sec169_\d+_\d+$' -or $TRANSIENT_DB -ne "db_transient_$EXEC_RUN_ID" -or $TRANSIENT_DB -eq $TEMPLATE_DB -or $TRANSIENT_DB -eq "postgres") {
                    throw "FATAL / SECURITY FAIL: Identidade do banco efemero divergente da execucao atual ou perigosa: '$TRANSIENT_DB'!"
                }

                Write-Host " Executando DROP DATABASE $TRANSIENT_DB WITH (FORCE)..." -ForegroundColor DarkGray
                $dropDbCmd = "DROP DATABASE IF EXISTS $TRANSIENT_DB WITH (FORCE);"
                $dropRes = Invoke-DockerCmd -Arguments "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $TEMPLATE_DB -t -A -c `"$dropDbCmd`""
                if ($dropRes.ExitCode -ne 0) {
                    throw "Falha ao executar DROP DATABASE no container: $($dropRes.Stderr.Trim())"
                }

                # 3. Verificacao posterior ao DROP DATABASE por consulta direta a pg_database
                $verifyDropQuery = "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$TRANSIENT_DB');"
                $verifyRes = Invoke-DockerCmd -Arguments "exec -i $TARGET_CONTAINER psql -X -v ON_ERROR_STOP=1 -U $TARGET_USER -d $TEMPLATE_DB -t -A -c `"$verifyDropQuery`""
                if ($verifyRes.ExitCode -ne 0) {
                    throw "FATAL / CLEANUP QUERY FAIL: Falha ao consultar pg_database apos DROP (ExitCode $($verifyRes.ExitCode))!"
                }
                if ($verifyRes.Stdout.Trim() -ne "f") {
                    throw "FATAL / ASSERTION FAIL: Banco efemero '$TRANSIENT_DB' ainda existe no catalogo pg_database apos comando DROP!"
                }

                $transientDbState = "DROPPED_CONFIRMED"
                Write-Host " [OK] Descarte do banco efemero confirmado no catalogo pg_database (Estado: DROPPED_CONFIRMED | Zero residuos)." -ForegroundColor Green
            } catch {
                $cleanupError = $_
                Write-Host " [FALHA NO CLEANUP / DESCARTE] $_" -ForegroundColor Red
            }
        }

        "DROPPED_CONFIRMED" {
            Write-Host " [OK] Banco efemero ja se encontra no estado DROPPED_CONFIRMED." -ForegroundColor Green
        }

        default {
            $cleanupError = "FATAL / STATE ERROR: Estado desconhecido na maquina de estados: '$transientDbState'!"
            Write-Host " [FALHA DE MAQUINA DE ESTADOS] $cleanupError" -ForegroundColor Red
        }
    }
}

if ($null -ne $executionError -or $null -ne $cleanupError -or $transientDbState -ne "DROPPED_CONFIRMED") {
    Write-Host "`n==================================================================" -ForegroundColor Red
    Write-Host " RESULTADO: FAIL - HOMOLOGACAO SEC-16.9 APRESENTOU FALHAS!" -ForegroundColor Red
    Write-Host " Estado Final do Banco Transiente: $transientDbState" -ForegroundColor Red
    if ($null -ne $executionError) {
        Write-Host "   Falha de Execucao: $executionError" -ForegroundColor Red
    }
    if ($null -ne $cleanupError) {
        Write-Host "   Falha de Cleanup / Ciclo de Vida: $cleanupError" -ForegroundColor Red
    }
    Write-Host "==================================================================" -ForegroundColor Red
    exit 1
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host " HOMOLOGACAO SEC-16.9 CONCLUIDA COM EXITO COMPROVADO (FIX 11L.1)!" -ForegroundColor Green
Write-Host " Concorrencia real de duas sessoes PostgreSQL comprovada:" -ForegroundColor Green
Write-Host "   1. Observacao ativa de bloqueio de tupla em pg_stat_activity/pg_blocking_pids: PASS" -ForegroundColor Green
Write-Host "   2. Cenario 1 (Exclusao vence -> Aceite bloqueado com P0001): PASS" -ForegroundColor Green
Write-Host "   3. Cenario 2 (Aceite vence   -> Exclusao bloqueada com P0001): PASS" -ForegroundColor Green
Write-Host "   4. Integridade de tenant_invitations, profiles, permissions e audit_log: PASS" -ForegroundColor Green
Write-Host "   5. Maquina de estados: NOT_STARTED -> CREATE_UNCERTAIN -> CREATED_CONFIRMED -> DROPPED_CONFIRMED: PASS" -ForegroundColor Green
Write-Host "   6. Limpeza total comprovada no catalogo pg_database (Resultado: 'f' - Zero residuos): PASS" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
exit 0
