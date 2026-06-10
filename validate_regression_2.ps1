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

$loteId = "6cb106bd-4a94-41de-bb3c-8590488e09c1"
$lancamentos = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/lancamentos_diaristas?select=diarista_id,nome_colaborador,cpf_colaborador,valor_calculado&lote_fechamento_id=eq.$loteId" -Headers $headers -Method Get
$lancamentos | ConvertTo-Json -Depth 5 | Out-File "val_lancamentos.txt" -Encoding utf8

$diaristaId = $lancamentos[0].diarista_id
$colab = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/colaboradores?select=nome,cpf,banco_codigo,agencia,conta&id=eq.$diaristaId" -Headers $headers -Method Get
$colab | ConvertTo-Json -Depth 5 | Out-File "val_colab.txt" -Encoding utf8
