$filePath = 'g:\pk\pk\azrar-mhamoud-qattoush-recovered\build\sql-express-install.ps1'
# Read as raw text
$txt = [System.IO.File]::ReadAllText($filePath)
# 1. Remove ALL trailing whitespace from ALL lines
$txt = [regex]::Replace($txt, '[ \t]+(\r?\n)', '$1')
$txt = [regex]::Replace($txt, '[ \t]+$', '')
# 2. Ensure all closing "@ are at the very start of the line
$txt = [regex]::Replace($txt, '(\r?\n)[ \t]+\"@(\r?\n)', '$1"@$2')
# 3. Double check the line 151 pipe issue
$txt = $txt -replace '(?<=\r?\n)\"@\|', "`"@`r`n|"
# Write back as UTF-8 with BOM
[System.IO.File]::WriteAllText($filePath, $txt, [System.Text.Encoding]::UTF8)
