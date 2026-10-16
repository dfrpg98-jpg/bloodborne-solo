<#
List the reviewed disposable files. Nothing is deleted unless -Apply is supplied.
Run manually in PowerShell: .\scripts\maintenance\cleanup-workspace.ps1 -Apply
Use -FramesOnly to preserve all ZIP archives. No directories are deleted.
#>
[CmdletBinding()]
param([switch]$Apply, [switch]$FramesOnly)
$ErrorActionPreference = 'Stop'
$taskRepository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$taskScope = 'C:\Users\GOOD\Documents\Codex\2026-10-11\new-chat'
$taskHandoffPath = Join-Path $taskRepository 'docs\maintenance\delete-handoff-2026-10-16.json'
if (Test-Path -LiteralPath $taskHandoffPath) {
    $taskHandoff = Get-Content -LiteralPath $taskHandoffPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Write-Output ("Inspection folder: {0}" -f $taskHandoff.Directory)
    Write-Output ("Status: {0}; grouped files: {1:N0}; no deletion performed." -f $taskHandoff.Status, $taskHandoff.MovedFiles)
    if ($Apply) { throw 'This old deletion command is retired. Inspect the grouped folder first; nothing was deleted.' }
    return
}
$taskReport = Join-Path $taskRepository 'docs\maintenance\storage-audit-2026-10-16.json'
if ((Get-FileHash -LiteralPath $taskReport -Algorithm SHA256).Hash -ine '203ba57ade280be261a101e5760bd3cf357b9a2054c21072b2fd4dee073e369d') {
    throw 'The reviewed manifest changed; regenerate and review the cleanup plan first.'
}
$taskAudit = Get-Content -LiteralPath $taskReport -Raw -Encoding UTF8 | ConvertFrom-Json
if (@($taskAudit.sourceEntries).Count -ne 189 -or @($taskAudit.safeManualDeletionPaths).Count -ne 25 -or
    $taskAudit.scope.canonicalRepository -ine $taskRepository) { throw 'Incomplete or mismatched preservation manifest' }
$taskDesktop = [string]$taskAudit.scope.desktop

function Confirm-BoundedPath([string]$Candidate, [string]$Boundary) {
    $resolved = (Resolve-Path -LiteralPath $Candidate -ErrorAction Stop).ProviderPath
    $base = [IO.Path]::GetFullPath($Boundary).TrimEnd('\')
    if (-not $resolved.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside the reviewed directory: $resolved"
    }
    $parent = $resolved
    while ($parent.Length -ge $base.Length) {
        if ((Get-Item -LiteralPath $parent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Linked paths are excluded: $parent"
        }
        if ($parent -eq $base) { break }
        $parent = [IO.Path]::GetDirectoryName($parent)
    }
    return $resolved
}

$taskFrameRoots = @(
    'work\local-final-validation\motion-initial66',
    'work\local-final-validation\motion',
    'work\local-final-validation\motion-additional17'
)
$taskPlan = [Collections.Generic.List[object]]::new()
foreach ($relative in $taskFrameRoots) {
    $candidate = Join-Path $taskScope $relative
    if (-not (Test-Path -LiteralPath $candidate)) { continue }
    $resolved = Confirm-BoundedPath $candidate $taskScope
    $directories = [Collections.Generic.Stack[string]]::new()
    $directories.Push($resolved)
    while ($directories.Count) {
        $directory = $directories.Pop()
        foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked paths are excluded: $($entry.FullName)" }
            if ($entry.PSIsContainer) { $directories.Push($entry.FullName) }
            elseif ($entry.Extension -ieq '.png') {
                $taskPlan.Add([pscustomobject]@{ Path = $entry.FullName; Bytes = [long]$entry.Length; Kind = 'generated-frame' })
            }
        }
    }
}

if (-not $FramesOnly) {
    $archiveRoot = Join-Path $taskScope 'outputs\archive\backups'
    foreach ($archive in $taskAudit.safeManualDeletionPaths) {
        if (-not (Test-Path -LiteralPath $archive.path)) { continue }
        $resolved = Confirm-BoundedPath $archive.path $archiveRoot
        if ((Split-Path -Leaf $resolved) -notmatch '^bloodborne-solo-before-v\d+\.\d+\.\d+\.zip$') { throw 'Unreviewed archive name' }
        if ((Get-Item -LiteralPath $resolved).Length -ne $archive.bytes) { throw "Archive size changed: $resolved" }
        $taskPlan.Add([pscustomobject]@{ Path = $resolved; Bytes = [long]$archive.bytes; Kind = 'duplicate-backup'; SHA256 = $archive.sha256 })
    }
}

$taskBytes = ($taskPlan | Measure-Object -Property Bytes -Sum).Sum
Write-Output ("Reviewed files: {0:N0}; reclaimable: {1:N3} GiB; apply: {2}" -f $taskPlan.Count, ($taskBytes / 1GB), $Apply.IsPresent)
$taskPlan | Group-Object Kind | ForEach-Object {
    Write-Output ("  {0}: {1:N0} files, {2:N3} GiB" -f $_.Name, $_.Count, (($_.Group | Measure-Object Bytes -Sum).Sum / 1GB))
}
if (-not $Apply) { Write-Output 'Dry run only. Add -Apply to delete the reviewed files, or -FramesOnly to exclude archives.'; return }

# Verify every preservation and archive prerequisite before deleting any file.
if (-not $FramesOnly -and ($taskPlan | Where-Object Kind -eq 'duplicate-backup')) {
    foreach ($source in $taskAudit.sourceEntries) {
        $covered = $false
        foreach ($copy in $source.desktopCopies) {
            if (-not (Test-Path -LiteralPath $copy)) { continue }
            $resolved = Confirm-BoundedPath $copy $taskDesktop
            if ((Get-Item -LiteralPath $resolved).Length -eq $source.bytes -and
                (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash -ieq $source.sha256) { $covered = $true; break }
        }
        if (-not $covered) { throw "Preserved source is missing or changed: $($source.relativePath)" }
    }
    $tags = @($taskAudit.safeManualDeletionPaths.recoverRuntimeFromTag | Sort-Object -Unique)
    $remoteLines = & git -C $taskRepository ls-remote --tags origin @($tags | ForEach-Object { 'refs/tags/' + $_ })
    if ($LASTEXITCODE -ne 0) { throw 'Cannot verify remote Git tags; archives are preserved.' }
    foreach ($tag in $tags) {
        $remoteTag = @($remoteLines | Where-Object { $_.EndsWith("refs/tags/$tag") })
        if ($remoteTag.Count -ne 1) { throw "Remote recovery tag missing: $tag" }
        $localTag = & git -C $taskRepository rev-parse "refs/tags/$tag"
        if ($LASTEXITCODE -ne 0 -or ($remoteTag[0] -split '\s+')[0] -ine $localTag) { throw "Remote recovery tag differs: $tag" }
    }
    foreach ($item in $taskPlan | Where-Object Kind -eq 'duplicate-backup') {
        if ((Get-FileHash -LiteralPath $item.Path -Algorithm SHA256).Hash -ine $item.SHA256) { throw "Archive content changed: $($item.Path)" }
    }
}

$taskRemoved = 0L
$taskRemovedBytes = 0L
foreach ($item in $taskPlan) {
    $resolved = Confirm-BoundedPath $item.Path $taskScope
    if ((Get-Item -LiteralPath $resolved).Length -ne $item.Bytes) { throw "File changed after review: $resolved" }
    Remove-Item -LiteralPath $resolved -Force -ErrorAction Stop
    $taskRemoved++
    $taskRemovedBytes += $item.Bytes
    if ($taskRemoved % 2000 -eq 0) { Write-Output "Removed $taskRemoved / $($taskPlan.Count) files" }
}
Write-Output ("Removed {0:N0} files, {1:N3} GiB. Source photos, recordings, reports, Git history and directories were preserved." -f $taskRemoved, ($taskRemovedBytes / 1GB))
