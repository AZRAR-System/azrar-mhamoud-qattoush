$ErrorActionPreference = 'SilentlyContinue'
$errors = $null
$tokens = $null
[Management.Automation.Language.Parser]::ParseFile('build\sql-express-install.ps1', [ref]$tokens, [ref]$errors)
if ($errors) {
    $errors | ForEach-Object {
        "ERROR:{0}:{1} {2}" -f $_.Extent.StartLineNumber, $_.Extent.StartColumnNumber, $_.Message
    }
} else {
    "VALID"
}
