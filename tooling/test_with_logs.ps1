param(
    [string]$TestFile = "tests/power-reader.spec.ts"
)

$logDir = "test_logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir }
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = Join-Path $logDir "test_run_$timestamp.log"

Write-Host "Running $TestFile and saving to $logFile..." -ForegroundColor Cyan

# Set environment variable for verbose logging if running a single file
$env:PW_SINGLE_FILE_RUN = "true"

# Run playwright with list reporter and capture everything
npx playwright test $TestFile --reporter=list,json --output=$logDir/report.json *>&1 | Tee-Object -FilePath $logFile

# Get the absolute path for easier access
$absLogFile = (Resolve-Path $logFile).Path
Write-Host "`nTest run complete." -ForegroundColor Green
Write-Host "Full Log: " -NoNewline -ForegroundColor Green
Write-Host $absLogFile -ForegroundColor Cyan
Write-Host "LOG_PATH: $absLogFile"
