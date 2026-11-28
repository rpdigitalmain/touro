import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

// Read Windows DACLs in one process. Ignore inherited-only entries and deny rules:
// an allow entry for an untrusted identity is enough to reject the cache.
const script = Buffer.from(`
$ErrorActionPreference = 'Stop'
$inputPaths = ConvertFrom-Json $env:TOURO_CACHE_ACL_INPUT
$sidType = [Security.Principal.SecurityIdentifier]
$trusted = @(
  [Security.Principal.WindowsIdentity]::GetCurrent().User.Value,
  'S-1-5-18',
  'S-1-5-32-544',
  'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'
)

function Test-Access($path, $protected, $descend) {
  $attributes = [IO.File]::GetAttributes($path)
  if ($attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw "Unexpected reparse point: $path"
  }
  $directory = ($attributes -band [IO.FileAttributes]::Directory) -ne 0
  if ($directory) { $acl = [IO.Directory]::GetAccessControl($path) }
  else { $acl = [IO.File]::GetAccessControl($path) }
  $descriptor = [Security.AccessControl.RawSecurityDescriptor]::new($acl.GetSecurityDescriptorBinaryForm(), 0)
  if ($trusted -notcontains $acl.GetOwner($sidType).Value -or $null -eq $descriptor.DiscretionaryAcl) {
    throw "Untrusted owner or missing access control list: $path"
  }

  # Ancestors may allow creating unrelated entries, as the Windows volume root does.
  $mask = 0x500D0150
  if ($protected) { $mask = $mask -bor 6 }
  foreach ($rule in $acl.GetAccessRules($true, $true, $sidType)) {
    if ($rule.AccessControlType -eq 'Allow' -and
        -not ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) -and
        ($rule.FileSystemRights -band $mask) -and
        $trusted -notcontains $rule.IdentityReference.Value) {
      throw "Untrusted write permission: $path"
    }
  }
  if ($descend -and $directory) {
    foreach ($entry in [IO.Directory]::EnumerateFileSystemEntries($path)) {
      Test-Access $entry $true $true
    }
  }
}

foreach ($ancestor in $inputPaths.ancestors) {
  Test-Access $ancestor ($ancestor -eq $inputPaths.cache) $false
}
if ($inputPaths.runtime) { Test-Access $inputPaths.runtime $true $true }
`, 'utf16le').toString('base64');

export async function verifyWindowsCacheAccess(ancestors, cache, runtime) {
  const powershell = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  await run(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', script], {
    windowsHide: true,
    timeout: 15_000,
    env: { ...process.env, TOURO_CACHE_ACL_INPUT: JSON.stringify({ ancestors, cache, runtime }) },
  });
}
