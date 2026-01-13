# Update package.json with new scripts
$packagePath = "C:\Users\qpqp_\OneDrive\Desktop\pk\copy-of-khaberni-real-estate-system-mastar1 (3)\package.json"

$pkg = Get-Content $packagePath -Raw | ConvertFrom-Json

# Add new scripts
$pkg.scripts | Add-Member -NotePropertyName "test" -NotePropertyValue "jest" -Force
$pkg.scripts | Add-Member -NotePropertyName "test:watch" -NotePropertyValue "jest --watch" -Force
$pkg.scripts | Add-Member -NotePropertyName "test:coverage" -NotePropertyValue "jest --coverage" -Force
$pkg.scripts | Add-Member -NotePropertyName "lint" -NotePropertyValue "eslint src electron --ext .ts,.tsx,.js,.jsx" -Force
$pkg.scripts | Add-Member -NotePropertyName "format" -NotePropertyValue "prettier --write src/**/* electron/**/*" -Force

# Do not set $pkg.build to a string. electron-builder expects the "build" field
# in package.json to be an object, not a string path.
# The project uses --config electron-builder.config.cjs from scripts/desktop-dist.ps1.

# Save
$pkg | ConvertTo-Json -Depth 10 | Set-Content $packagePath -Encoding UTF8

Write-Host "✅ Package.json updated successfully!" -ForegroundColor Green
