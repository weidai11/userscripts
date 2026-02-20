param (
    [Parameter(Mandatory=$true)]
    [string]$FileName
)

while (Test-Path $FileName) {
    Start-Sleep -Milliseconds 500
}

Write-Host "deleted"
