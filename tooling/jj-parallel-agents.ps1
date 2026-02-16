[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string] $RepoRoot = (Get-Location).Path,

  # Base revision/bookmark all agents should start from (e.g. "main")
  [Parameter(Mandatory = $false)]
  [string] $BaseRev = "main",

  # Workspace directories you want (relative to RepoRoot is fine)
  [Parameter(Mandatory = $false)]
  [string[]] $Workspaces = @("..\\mm", "..\\flash", "..\\bp"),

  # Where to write patches and IDs
  [Parameter(Mandatory = $false)]
  [string] $OutDir = (Join-Path $RepoRoot "jj-agent-compare"),

  # Step 1: create workspaces (jj workspace add)
  [switch] $Setup,

  # If set with -Setup: forget + delete + recreate the workspace dirs
  [switch] $Force,

  # Step 2/3: in each workspace, jj new <base> and jj describe
  [switch] $Init,

  # Step 6/7: capture IDs and write patches/diffs
  [switch] $Compare
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBomFile {
  param(
    [Parameter(Mandatory=$true)][string] $Path,
    [Parameter(Mandatory=$true)][string] $Text
  )
  
  # PS 7+ has utf8NoBOM, PS 5.1 needs manual UTF8Encoding
  if ($PSVersionTable.PSVersion.Major -ge 6) {
    $Text | Set-Content -Encoding utf8NoBOM -Path $Path
  } else {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
  }
}

function Resolve-FullPath([string] $Path, [string] $Base) {
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  $combined = Join-Path $Base $Path
  # Return normalized absolute path without calling Resolve-Path (which fails if path doesn't exist yet)
  return [System.IO.Path]::GetFullPath($combined)
}

function Invoke-JJ {
  param(
    [Parameter(Mandatory=$true)][string] $WorkingDir,
    [Parameter(Mandatory=$true)][string[]] $Args
  )
  Push-Location $WorkingDir
  try {
    & jj --no-pager @Args
    if ($LASTEXITCODE -ne 0) {
      throw "jj exited with code ${LASTEXITCODE} in ${WorkingDir}``: jj $($Args -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Get-WorkspaceName {
  param([Parameter(Mandatory=$true)][string] $WorkspaceDir)
  
  # Try to get the workspace name from jj workspace list
  Push-Location $WorkspaceDir
  try {
    $output = & jj --no-pager workspace list 2>&1
    if ($LASTEXITCODE -eq 0) {
      # Parse output to find current workspace (marked with @)
      foreach ($line in $output) {
        if ($line -match '^(\S+)@') {
          return $matches[1]
        }
      }
    }
  } catch {
    # Ignore errors
  } finally {
    Pop-Location
  }
  
  # Fallback to directory name
  return (Split-Path $WorkspaceDir -Leaf)
}

function Try-ForgetWorkspace {
  param(
    [Parameter(Mandatory=$true)][string] $WorkspaceDir,
    [Parameter(Mandatory=$true)][string] $RepoRoot
  )

  if (-not (Test-Path $WorkspaceDir)) { return }

  # Try to get the workspace name and forget it from the repo root
  $wsName = Get-WorkspaceName -WorkspaceDir $WorkspaceDir
  
  try {
    Push-Location $RepoRoot
    try {
      Write-Host "  Forgetting workspace: $wsName"
      & jj --no-pager workspace forget $wsName 2>&1 | Out-Null
    } finally {
      Pop-Location
    }
  } catch {
    # If it fails (workspace not registered), that's fine
    Write-Host "  (workspace $wsName not registered or already forgotten)"
  }
}

function Get-JJIds {
  param([Parameter(Mandatory=$true)][string] $WorkspaceDir)

  # Template prints: "<commit_id> <change_id>\n"
  $template = 'commit_id ++ " " ++ change_id ++ "\n"'

  Push-Location $WorkspaceDir
  try {
    $line = & jj --no-pager log -r '@' --no-graph -T $template
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to read jj ids in ${WorkspaceDir}"
    }
  } finally {
    Pop-Location
  }

  $parts = ($line.Trim() -split "\s+")
  if ($parts.Count -lt 2) {
    throw "Unexpected jj log output in ${WorkspaceDir}``: $line"
  }

  [pscustomobject]@{
    Workspace = $WorkspaceDir
    CommitId  = $parts[0]
    ChangeId  = $parts[1]
  }
}

if (-not ($Setup -or $Init -or $Compare)) {
  throw "Specify -Setup and/or -Init and/or -Compare"
}

$RepoRoot = Resolve-FullPath $RepoRoot (Get-Location).Path
$ResolvedWorkspaces = $Workspaces | ForEach-Object {
  if ([System.IO.Path]::IsPathRooted($_)) { $_ } else { Resolve-FullPath $_ $RepoRoot }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

if ($Setup) {
  foreach ($ws in $ResolvedWorkspaces) {
    $wsName = Split-Path $ws -Leaf
    Write-Host "Setup workspace dir: $ws"

    if ($Force) {
      Write-Host "  Force enabled: forgetting (if needed) and deleting $ws"
      Try-ForgetWorkspace -WorkspaceDir $ws -RepoRoot $RepoRoot
      if (Test-Path $ws) { Remove-Item -Recurse -Force $ws }
    }

    if (-not (Test-Path $ws)) {
      Write-Host "  Creating workspace: jj workspace add $ws"
      Invoke-JJ -WorkingDir $RepoRoot -Args @("workspace", "add", $ws)
    } else {
      Write-Host "  Directory exists; skipping workspace add: $ws"
    }
  }
}

if ($Init) {
  foreach ($ws in $ResolvedWorkspaces) {
    $name = Split-Path $ws -Leaf
    Write-Host "Init change in: $ws"

    # Start each workspace from the same base revision
    Invoke-JJ -WorkingDir $ws -Args @("new", $BaseRev)

    # Give it a recognizable description
    Invoke-JJ -WorkingDir $ws -Args @("describe", "-m", "Agent $name attempt")

    # Quick sanity check / snapshot
    Invoke-JJ -WorkingDir $ws -Args @("st")
  }

  Write-Host ""
  Write-Host "Init done. Run your agents manually in each workspace directory."
}

if ($Compare) {
  $ids = foreach ($ws in $ResolvedWorkspaces) { Get-JJIds -WorkspaceDir $ws }

  $csvPath = Join-Path $OutDir "agent_ids.csv"
  $ids | Export-Csv -NoTypeInformation -Path $csvPath
  Write-Host "Wrote: $csvPath"

  # Patch each agent vs base
  foreach ($row in $ids) {
    $leaf = Split-Path $row.Workspace -Leaf
    $patchPath = Join-Path $OutDir ("{0}_vs_{1}.patch" -f $leaf, $BaseRev)

    Write-Host "Patch: $patchPath"
    Push-Location $row.Workspace
    try {
      $txt = (& jj --no-pager diff --git --from $BaseRev --to $row.CommitId) -join "`n"
      if ($LASTEXITCODE -ne 0) {
        throw "jj diff failed in $($row.Workspace)"
      }
      Write-Utf8NoBomFile -Path $patchPath -Text $txt
    } finally {
      Pop-Location
    }
  }

  # Pairwise diffs between agents
  for ($a = 0; $a -lt $ids.Count; $a++) {
    for ($b = $a + 1; $b -lt $ids.Count; $b++) {
      $wa = Split-Path $ids[$a].Workspace -Leaf
      $wb = Split-Path $ids[$b].Workspace -Leaf
      $pairPath = Join-Path $OutDir ("diff_{0}_to_{1}.patch" -f $wa, $wb)

      Write-Host "Pairwise patch: $pairPath"
      Push-Location $ids[$a].Workspace
      try {
        $txt = (& jj --no-pager diff --git --from $ids[$a].CommitId --to $ids[$b].CommitId) -join "`n"
        if ($LASTEXITCODE -ne 0) {
          throw "jj diff failed for $wa -> $wb"
        }
        Write-Utf8NoBomFile -Path $pairPath -Text $txt
      } finally {
        Pop-Location
      }
    }
  }

  Write-Host ""
  Write-Host "Compare done. Open patches in your IDE, or diff the patch files."
}
