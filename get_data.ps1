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

$lotes = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/diaristas_lotes_fechamento?select=id,status,valor_total,empresa_id,periodo_inicio,periodo_fim,empresas(nome)&valor_total=eq.360" -Headers $headers -Method Get
Write-Host "--- DIARISTAS ---"
$lotes | ConvertTo-Json -Depth 10

$rh_lotes = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rh_financeiro_lotes?select=id,status,valor_total,competencia,tipo,empresa_id,empresas(nome)&valor_total=eq.360" -Headers $headers -Method Get
Write-Host "--- RH_FINANCEIRO ---"
$rh_lotes | ConvertTo-Json -Depth 10
