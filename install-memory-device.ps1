param(
    [Parameter(Mandatory=$true)][string]$Gateway,
    [string]$Id = 'desktop',
    [string]$Name,
    [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }),
    [string]$State = (Join-Path (Split-Path -Parent $CodexHome) '.agent-node-memory-device'),
    [string]$NodePath,
    [string]$TailscalePath,
    [string]$SyncthingArchive,
    [string]$SkillsRoot,
    [string]$PeerSkills,
    [string]$PeerSkillsInstructions
)
$ErrorActionPreference = 'Stop'
foreach ($extension in @('.COM','.EXE','.BAT','.CMD')) {
    if ($env:PATHEXT.Split(';') -notcontains $extension) { $env:PATHEXT += ';' + $extension }
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
New-Item -ItemType Directory -Force $State | Out-Null
# MSIX applications can redirect LocalAppData. Scheduled tasks need the real path.
$physicalState = @((Get-Item -LiteralPath $State).Target) | Select-Object -First 1
if ($physicalState) { $State = $physicalState }
if (!$Name) {
    $savedMetadata = Join-Path $State 'device.json'
    if (Test-Path $savedMetadata) { $Name = (Get-Content $savedMetadata -Raw | ConvertFrom-Json).name }
    if (!$Name) { $Name = $env:COMPUTERNAME }
}
$account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
# Only this user and SYSTEM may read the dedicated device certificate and API key.
& icacls.exe $State /inheritance:r /grant:r "${account}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot protect memory device state directory' }
if (!$NodePath) {
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { $NodePath = $cmd.Source }
    elseif (Test-Path "$env:ProgramFiles\nodejs\node.exe") { $NodePath = "$env:ProgramFiles\nodejs\node.exe" }
    else { throw 'Install Node.js 18+ or pass -NodePath.' }
}
$major = [int]((& $NodePath --version).TrimStart('v').Split('.')[0])
if ($major -lt 18) { throw 'Node.js 18+ is required.' }
if (!$TailscalePath) {
    $cmd = Get-Command tailscale.exe -ErrorAction SilentlyContinue
    if ($cmd) { $TailscalePath = $cmd.Source }
    else {
        $service = Get-CimInstance Win32_Service -Filter "Name='Tailscale'"
        if ($service.PathName -match '^"?(.+?)tailscaled\.exe') { $TailscalePath = Join-Path $Matches[1] 'tailscale.exe' }
    }
}
if (!(Test-Path $TailscalePath)) { throw 'Install and sign into Tailscale first.' }
$binary = Join-Path $State 'syncthing.exe'
$hash = '8c5dcba5566df4f37d9daf8613afbeaea74702a719324d1fe877535761038b64'
$archive = Join-Path $State 'syncthing.zip'
if ($SyncthingArchive) { Copy-Item $SyncthingArchive $archive -Force }
elseif (!(Test-Path $binary)) { Invoke-WebRequest 'https://github.com/syncthing/syncthing/releases/download/v1.29.0/syncthing-windows-amd64-v1.29.0.zip' -OutFile $archive -UseBasicParsing }
if (Test-Path $archive) {
    if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToLower() -ne $hash) { throw 'Syncthing archive checksum mismatch' }
    $unpack = Join-Path $State 'unpack'
    Expand-Archive $archive $unpack -Force
    $source = Get-ChildItem $unpack -Filter syncthing.exe -Recurse | Select-Object -First 1
    if (!(Test-Path $binary) -or ((Get-FileHash $binary).Hash -ne (Get-FileHash $source.FullName).Hash)) { Copy-Item $source.FullName $binary -Force }
    Remove-Item $archive,$unpack -Recurse -Force
}
$setup = Join-Path $State 'setup.mjs'
$bundled = Join-Path $PSScriptRoot '..\memory-device\setup.mjs'
if (Test-Path $bundled) { Copy-Item $bundled $setup -Force }
else { Invoke-WebRequest 'https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/setup-memory-device.mjs' -OutFile $setup -UseBasicParsing }
$skillModule = Join-Path $State 'skills.mjs'
$bundledSkills = Join-Path $PSScriptRoot '..\memory-device\skills.mjs'
if (Test-Path $bundledSkills) { Copy-Item $bundledSkills $skillModule -Force }
else { Invoke-WebRequest 'https://raw.githubusercontent.com/magicpsyche/openhands-toolkit-installer/main/skills-device.mjs' -OutFile $skillModule -UseBasicParsing }
$setupArgs = @($setup,'--gateway',$Gateway,'--id',$Id,'--name',$Name,'--codex-home',$CodexHome,'--state',$State,'--syncthing',$binary,'--tailscale',$TailscalePath)
if ($SkillsRoot) { $setupArgs += @('--skills-root',$SkillsRoot) }
if ($PeerSkills) { $setupArgs += @('--peer-skills',$PeerSkills) }
if ($PeerSkillsInstructions) { $setupArgs += @('--peer-skills-instructions',$PeerSkillsInstructions) }
& $NodePath @setupArgs
if ($LASTEXITCODE -ne 0) { throw 'Memory device enrollment failed' }
$runner = Join-Path $State 'Run-Syncthing.ps1'
@'
$ErrorActionPreference = 'Stop'
$env:STNOUPGRADE = '1'
$env:STNODEFAULTFOLDER = '1'
$binary = Join-Path $PSScriptRoot 'syncthing.exe'
$homePath = Join-Path $PSScriptRoot 'syncthing'
$arguments = @('serve', ('--home="' + $homePath + '"'), '--no-browser', '--no-restart')
$process = Start-Process -FilePath $binary -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $PSScriptRoot 'service.log') -RedirectStandardError (Join-Path $PSScriptRoot 'service-error.log')
$process.WaitForExit()
exit $process.ExitCode
'@ | Set-Content $runner -Encoding UTF8
$action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $runner + '"')
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $account
$principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'AgentNode-CodexMemory' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
[xml]$xml = Get-Content (Join-Path $State 'syncthing\config.xml')
# Move the installation's temporary daemon under the logon task.
$old = Get-ScheduledTask -TaskName 'AgentNode-CodexMemory'
if ($old.State -ne 'Running') {
    Invoke-RestMethod 'http://127.0.0.1:18485/rest/system/shutdown' -Method Post -Headers @{'X-API-Key'=[string]$xml.configuration.gui.apikey} | Out-Null
    Start-Sleep -Seconds 2
    Start-ScheduledTask -TaskName 'AgentNode-CodexMemory'
}
# Refresh exported Skill files and peer authorization using the SAME Syncthing.
$refreshConfig = @{node=$NodePath;setup=$setup;gateway=$Gateway;id=$Id;name=$Name;codex_home=$CodexHome;state=$State;syncthing=$binary;tailscale=$TailscalePath}
$refreshConfig | ConvertTo-Json | Set-Content (Join-Path $State 'refresh.json') -Encoding UTF8
$refreshRunner = Join-Path $State 'Refresh-Shares.ps1'
@'
$ErrorActionPreference = 'Stop'
foreach ($extension in @('.COM','.EXE','.BAT','.CMD')) {
    if ($env:PATHEXT.Split(';') -notcontains $extension) { $env:PATHEXT += ';' + $extension }
}
try {
    $c = Get-Content (Join-Path $PSScriptRoot 'refresh.json') -Raw | ConvertFrom-Json
    & $c.node $c.setup --gateway $c.gateway --id $c.id --name $c.name --codex-home $c.codex_home --state $c.state --syncthing $c.syncthing --tailscale $c.tailscale --refresh true *> (Join-Path $PSScriptRoot 'refresh.log')
    exit $LASTEXITCODE
} catch { exit 1 }
'@ | Set-Content $refreshRunner -Encoding UTF8
$refreshAction = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $refreshRunner + '"')
$refreshTrigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 1)
$refreshSettings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'AgentNode-CodexSharesRefresh' -Action $refreshAction -Trigger $refreshTrigger -Principal $principal -Settings $refreshSettings -Force | Out-Null
Write-Host 'Device registered. Memory and optional Skill shares use the same Syncthing instance.'
