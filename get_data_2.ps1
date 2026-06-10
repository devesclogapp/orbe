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

$lotes = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/diaristas_lotes_fechamento?select=*&valor_total=eq.360" -Headers $headers -Method Get
If ($lotes) {
    $lotes | ConvertTo-Json -Depth 10 | Out-File "db_out.txt" -Encoding utf8
}

$rh_lotes = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rh_financeiro_lotes?select=*&valor_total=eq.360" -Headers $headers -Method Get
If ($rh_lotes) {
    $rh_lotes | ConvertTo-Json -Depth 10 | Out-File "db_out_rh.txt" -Encoding utf8
}
