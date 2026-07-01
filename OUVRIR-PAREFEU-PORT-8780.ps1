$ruleName = "Systeme Performance Durable SM - Port 8780"

Write-Host "Ouverture du port 8780 pour le reseau local..."

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "La regle existe deja."
} else {
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 8780 `
    -Action Allow `
    -Profile Private `
    | Out-Null
  Write-Host "Regle pare-feu ajoutee."
}

Write-Host ""
Write-Host "Adresse a partager avec les employes:"
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  ForEach-Object { Write-Host ("http://" + $_.IPAddress + ":8780/") }

