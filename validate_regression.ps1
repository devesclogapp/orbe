$envPath = ".env.local"
$envData = Get-Content $envPath
$supabaseUrl = ""
$supabaseKey = ""

foreach ($line in $envData) {
    if ($line -match "^VITE_SUPABASE_URL=(.*)$") {
        $supabaseUrl = $matches[1].Trim()
    }
    if ($line -match "^VITE_SUPABASE_ANON_KEY=(.*)$") {
        $supabaseKey = $matches[1].Trim()
    }
}

$headers = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
}

Write-Host "Verificando dados do lote de diarista R$ 360,00"
$loteId = "6cb106bd-4a94-41de-bb3c-8590488e09c1"

# Obter lancamentos diaristas para esse lote
$lancamentos = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/lancamentos_diaristas?select=diarista_id,nome_colaborador,cpf_colaborador,valor_calculado&lote_fechamento_id=eq.$loteId" -Headers $headers -Method Get
Write-Host "Lancamentos:"
$lancamentos | ConvertTo-Json -Depth 5

$diaristaId = $lancamentos[0].diarista_id
# Obter colaborador
$colab = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/colaboradores?select=nome,cpf,banco_codigo,agencia,conta&id=eq.$diaristaId" -Headers $headers -Method Get
Write-Host "Colaborador Bancário:"
$colab | ConvertTo-Json -Depth 5
