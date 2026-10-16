<# Move reviewed disposable files into one inspection folder. No deletion or copying. #>
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$taskRepository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$taskScope = 'C:\Users\GOOD\Documents\Codex\2026-10-11\new-chat'
$taskAuditPath = Join-Path $taskRepository 'docs\maintenance\storage-audit-2026-10-16.json'
if ((Get-FileHash -LiteralPath $taskAuditPath -Algorithm SHA256).Hash -ine '203ba57ade280be261a101e5760bd3cf357b9a2054c21072b2fd4dee073e369d') { throw 'Reviewed audit changed' }
$taskAudit = Get-Content -LiteralPath $taskAuditPath -Raw -Encoding UTF8 | ConvertFrom-Json
$taskFolderName = -join ([char[]]@(0xC0AD,0xC81C,0xB300,0xC0C1,0x005F,0xAC80,0xD1A0,0xD6C4,0xC0AD,0xC81C))
$taskTarget = [IO.Path]::GetFullPath((Join-Path $taskScope $taskFolderName))
$taskLedgerPath = Join-Path $taskRepository 'docs\maintenance\delete-handoff-2026-10-16.json'
if (Test-Path -LiteralPath $taskLedgerPath) { throw 'A handoff ledger already exists. Inspect it before moving again.' }

function Assert-Within([string]$Candidate, [string]$Boundary) {
    $full = [IO.Path]::GetFullPath($Candidate)
    $base = [IO.Path]::GetFullPath($Boundary).TrimEnd('\')
    if (-not $full.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Outside intended directory: $full" }
    $parent = $full
    while ($parent.Length -ge $base.Length) {
        if (Test-Path -LiteralPath $parent) {
            if ((Get-Item -LiteralPath $parent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked path excluded: $parent" }
        }
        if ($parent -eq $base) { break }
        $parent = [IO.Path]::GetDirectoryName($parent)
    }
}
Assert-Within $taskTarget $taskScope
if (Test-Path -LiteralPath $taskTarget) { throw 'Inspection folder already exists; nothing is overwritten.' }

$taskPlan = [Collections.Generic.List[object]]::new()
$taskGroups = [Collections.Generic.List[object]]::new()
foreach ($name in @('motion-initial66','motion','motion-additional17')) {
    $source = (Resolve-Path -LiteralPath (Join-Path $taskScope ('work\local-final-validation\' + $name))).ProviderPath
    Assert-Within $source $taskScope
    $destination = Join-Path $taskTarget ('generated-png\' + $name)
    Assert-Within $destination $taskTarget
    $entries = @(Get-ChildItem -LiteralPath $source -Recurse -Force)
    if ($entries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw "Linked content excluded: $source" }
    $files = @($entries | Where-Object { -not $_.PSIsContainer -and $_.Extension -ieq '.png' })
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($source.Length).TrimStart('\')
        $to = [IO.Path]::GetFullPath((Join-Path $destination $relative))
        if (-not $to.StartsWith($destination + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid relative path' }
        $taskPlan.Add([pscustomobject]@{ From = $file.FullName; To = $to; Bytes = [long]$file.Length; Kind = 'generated-png' })
    }
    $taskGroups.Add([pscustomobject]@{ OriginalRoot = $source; InspectionRoot = $destination; Filter = '*.png'; Files = $files.Count; Bytes = [long](($files | Measure-Object Length -Sum).Sum) })
}
foreach ($archive in $taskAudit.safeManualDeletionPaths) {
    $source = (Resolve-Path -LiteralPath $archive.path).ProviderPath
    Assert-Within $source (Join-Path $taskScope 'outputs\archive\backups')
    if ((Get-Item -LiteralPath $source).Length -ne $archive.bytes) { throw "Archive changed: $source" }
    $to = Join-Path $taskTarget ('duplicate-backup-zip\' + (Split-Path -Leaf $source))
    Assert-Within $to $taskTarget
    $taskPlan.Add([pscustomobject]@{ From = $source; To = $to; Bytes = [long]$archive.bytes; Kind = 'duplicate-backup-zip' })
}
if (($taskPlan | Where-Object Kind -eq 'generated-png').Count -ne 58580 -or
    ($taskPlan | Where-Object Kind -eq 'duplicate-backup-zip').Count -ne 25 -or
    ($taskPlan | Measure-Object Bytes -Sum).Sum -ne 25172452403) { throw 'Reviewed counts changed; no files moved.' }
if ([IO.Path]::GetPathRoot($taskTarget) -ine [IO.Path]::GetPathRoot($taskScope)) { throw 'Only same-volume moves are allowed.' }

$taskLedger = [ordered]@{
    Status = 'moving'; Directory = $taskTarget; MovedFiles = 0; MovedBytes = 0L
    ExpectedFiles = $taskPlan.Count; ExpectedBytes = 25172452403L
    Method = 'Native PowerShell Move-Item on the same volume; no copying, deletion or overwriting.'
    GeneratedPngGroups = @($taskGroups.ToArray())
    DuplicateZipFiles = @($taskAudit.safeManualDeletionPaths | ForEach-Object { [pscustomobject]@{ OriginalPath = $_.path; InspectionPath = (Join-Path $taskTarget ('duplicate-backup-zip\' + (Split-Path -Leaf $_.path))); Bytes = $_.bytes; SHA256 = $_.sha256; RecoveryTag = $_.recoverRuntimeFromTag } })
    PreservationAudit = 'storage-audit-2026-10-16.json'
    Preserved = @('Current source, runtime sprites and assets', 'Desktop original reference photographs and player saves', 'Original verification videos, JSON reports and extraction scripts', 'Git history and worktrees', 'before-v0.6.0.zip and runtime release archives')
}
function Save-Ledger { $taskLedger | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $taskLedgerPath -Encoding UTF8 }
New-Item -ItemType Directory -Path $taskTarget -ErrorAction Stop > $null
Save-Ledger
$taskDirectories = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($item in $taskPlan) {
    $parent = [IO.Path]::GetDirectoryName($item.To)
    if ($taskDirectories.Add($parent)) {
        Assert-Within $parent $taskTarget
        New-Item -ItemType Directory -Path $parent -Force -ErrorAction Stop > $null
    }
    if (Test-Path -LiteralPath $item.To) { throw "Destination exists: $($item.To)" }
    Move-Item -LiteralPath $item.From -Destination $item.To -ErrorAction Stop
    if ((Get-Item -LiteralPath $item.To).Length -ne $item.Bytes -or (Test-Path -LiteralPath $item.From)) { throw "Move verification failed: $($item.From)" }
    $taskLedger.MovedFiles++
    $taskLedger.MovedBytes += $item.Bytes
    if ($taskLedger.MovedFiles % 2500 -eq 0) { Save-Ledger; Write-Output "Moved $($taskLedger.MovedFiles) / $($taskPlan.Count) files" }
}
$taskResult = @(Get-ChildItem -LiteralPath $taskTarget -Recurse -File -Force)
if ($taskResult.Count -ne $taskPlan.Count -or ($taskResult | Measure-Object Length -Sum).Sum -ne $taskLedger.ExpectedBytes) { throw 'Final inspection inventory mismatch' }
$taskLedger.Status = 'prepared-for-user-inspection'
$taskLedger.CompletedAt = (Get-Date).ToString('o')
Save-Ledger
Write-Output "Inspection folder ready: $taskTarget"
Write-Output "Moved $($taskLedger.MovedFiles) files; $($taskLedger.MovedBytes) bytes. Nothing deleted."
