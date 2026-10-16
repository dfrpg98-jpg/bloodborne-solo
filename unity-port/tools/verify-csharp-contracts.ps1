param([Parameter(Mandatory=$true)][string]$InputPath)
$ErrorActionPreference = 'Stop'
$contractRoot = Split-Path -Parent $PSScriptRoot
$jsonAssembly = Join-Path $PSHOME 'Newtonsoft.Json.dll'
if (!(Test-Path -LiteralPath $jsonAssembly)) { throw 'PowerShell 7 Newtonsoft.Json.dll is required for this headless contract check.' }
# PowerShell's own Newtonsoft build may target an earlier System.Runtime than
# its host. The host already loads that assembly; runtime assertions below
# check the actual binding after suppressing only the unification warning.
Add-Type -Path (Join-Path $contractRoot 'UnityStarter/Assets/Bloodborne/Scripts/Contracts/PortContracts.cs') -ReferencedAssemblies $jsonAssembly -CompilerOptions '/nowarn:1701'
$script:assertions = 0
function Assert-Contract([bool]$Condition, [string]$Label) {
    if (!$Condition) { throw ('Contract assertion failed: ' + $Label) }
    $script:assertions++
}
function Assert-Rejected([string]$Text, [string]$Label) {
    $rejected = $false
    try { $null = [Bloodborne.Port.Contracts.PortJson]::ReadObject($Text) } catch { $rejected = $true }
    Assert-Contract $rejected $Label
}
$literal = '2026-10-13T12:00:00.000+05:30'
$object = [Bloodborne.Port.Contracts.PortJson]::ReadObject('{"type":"END_TURN","recordedAt":"2026-10-13T12:00:00.000+05:30","nested":["2026-10-13T00:00:00Z",null,true],"maxUint":4294967295}')
Assert-Contract ($object['recordedAt'].Type -eq [Newtonsoft.Json.Linq.JTokenType]::String) 'ISO timestamp remains a string'
Assert-Contract ([string]$object['recordedAt'] -ceq $literal) 'ISO offset and fractional literal preserved'
Assert-Contract ($object['nested'][0].Type -eq [Newtonsoft.Json.Linq.JTokenType]::String) 'nested ISO value remains a string'
Assert-Contract ($object['nested'][1].Type -eq [Newtonsoft.Json.Linq.JTokenType]::Null) 'null remains distinct from absent'
Assert-Contract ($null -eq $object.Property('absent')) 'absent property stays absent'
Assert-Contract ($object['nested'][2].Type -eq [Newtonsoft.Json.Linq.JTokenType]::Boolean) 'boolean preserved'
Assert-Contract ([long]$object['maxUint'] -eq 4294967295) 'uint maximum preserved'
Assert-Contract ($object.ToString([Newtonsoft.Json.Formatting]::None).Contains($literal)) 'serialization preserves timestamp spelling'
Assert-Rejected '{"type":"END_TURN","type":"MOVE"}' 'duplicate root property rejected'
Assert-Rejected '{"nested":{"x":1,"x":2}}' 'duplicate nested property rejected'
Assert-Rejected '{} {}' 'trailing object rejected'
Assert-Rejected '{} 1' 'trailing scalar rejected'
Assert-Rejected '[]' 'non-object root rejected'
Assert-Contract ($null -ne [Bloodborne.Port.Contracts.PortJson]::ReadObject("{} `r`n `t")) 'trailing whitespace accepted'
$inputs = [Bloodborne.Port.Contracts.PortJson]::ReadObject([IO.File]::ReadAllText($InputPath))
$candidate = [Bloodborne.Port.Contracts.PortJson]::ParseSaveForReplay([string]$inputs['save'])
Assert-Contract ([string]$candidate.Envelope['state']['commands'][0]['recordedAt'] -ceq $literal) 'real source save candidate preserves command string'
Assert-Contract ($candidate.Envelope['state']['commands'][0]['recordedAt'].Type -eq [Newtonsoft.Json.Linq.JTokenType]::String) 'real save command has string token'
$frame = [Bloodborne.Port.Contracts.PublicFrame]::new([Newtonsoft.Json.Linq.JObject]$inputs['view'],[Newtonsoft.Json.Linq.JArray]::new())
Assert-Contract ([string]$frame.View['sceneId'] -ceq [string]$inputs['view']['sceneId']) 'actual oracle public frame accepted'
$inputs['view']['hunter']['hp'] = 0
Assert-Contract ([int]$frame.View['hunter']['hp'] -ne 0) 'public frame deep clone isolates caller mutation'
$private = [Newtonsoft.Json.Linq.JObject]$frame.View.DeepClone()
$private['initialSeed'] = 90
$rejected = $false
try { [Bloodborne.Port.Contracts.PortJson]::ValidatePublicView($private) } catch { $rejected = $true }
Assert-Contract $rejected 'private root seed rejected'
$private = [Newtonsoft.Json.Linq.JObject]$frame.View.DeepClone()
$private['hunter']['deck'] = [Newtonsoft.Json.Linq.JArray]::new()
$rejected = $false
try { [Bloodborne.Port.Contracts.PortJson]::ValidatePublicView($private) } catch { $rejected = $true }
Assert-Contract $rejected 'private nested deck rejected'
$content = [Bloodborne.Port.Contracts.PortJson]::ReadContent([IO.File]::ReadAllText([string]$inputs['contentPath']))
Assert-Contract (@($content.TileGeometry.Properties()).Count -eq 20 -and @($content.WeaponVisuals.Properties()).Count -eq 15) 'actual exported content DTO read'
[pscustomobject]@{status='passed';assertions=$script:assertions;compiler='PowerShell Add-Type (Roslyn)';powerShellVersion=$PSVersionTable.PSVersion.ToString();newtonsoftAssembly=$jsonAssembly;newtonsoftVersion=[Newtonsoft.Json.Linq.JObject].Assembly.GetName().Version.ToString();scope=@('PortContracts.cs actual compilation','ISO strings and opaque save candidate fidelity','duplicate and trailing JSON rejection','public payload private-key rejection and deep clone','exported content DTO read');excluded=@('Unity Editor compilation','Unity package-specific Newtonsoft compile','full C# reducers','Unity scenes and animations')} | ConvertTo-Json -Depth 6 -Compress
