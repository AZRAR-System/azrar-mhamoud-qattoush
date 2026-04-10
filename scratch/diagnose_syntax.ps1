$filePath = 'g:\pk\pk\azrar-mhamoud-qattoush-recovered\build\sql-express-install.ps1'
$t = [System.IO.File]::ReadAllText($filePath)
"Length: $($t.Length)"
"Openings (@`"): $([regex]::Matches($t, '@"').Count)"
"Closings (`"@): $([regex]::Matches($t, '"@').Count)"
"Braces { : $([regex]::Matches($t, '\{').Count)"
"Braces } : $([regex]::Matches($t, '\}').Count)"
