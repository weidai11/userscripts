param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [int]$QuietSeconds = 30,
    [int]$PollIntervalMs = 500
)

$targetPath = [System.IO.Path]::GetFullPath($FilePath)

Write-Host "Waiting for file to exist: $targetPath"
while (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
    Start-Sleep -Milliseconds $PollIntervalMs
}

$item = Get-Item -LiteralPath $targetPath
$lastLength = $item.Length
$lastWriteUtc = $item.LastWriteTimeUtc
$lastChangeAt = Get-Date

Write-Host "File exists. Waiting for $QuietSeconds seconds with no changes..."
while ($true) {
    $currentItem = Get-Item -LiteralPath $targetPath -ErrorAction SilentlyContinue

    if ($null -eq $currentItem) {
        $lastLength = $null
        $lastWriteUtc = $null
        $lastChangeAt = Get-Date
        Start-Sleep -Milliseconds $PollIntervalMs
        continue
    }

    $currentLength = $currentItem.Length
    $currentWriteUtc = $currentItem.LastWriteTimeUtc

    if (($currentLength -ne $lastLength) -or ($currentWriteUtc -ne $lastWriteUtc)) {
        $lastLength = $currentLength
        $lastWriteUtc = $currentWriteUtc
        $lastChangeAt = Get-Date
    }

    if (((Get-Date) - $lastChangeAt).TotalSeconds -ge $QuietSeconds) {
        break
    }

    Start-Sleep -Milliseconds $PollIntervalMs
}

Write-Host "File is stable: $targetPath"
