$ErrorActionPreference = 'Stop'

# Generates a simple PNG icon at build/icon.png
# This keeps the repo text-only while still enabling a custom installer icon.

$outDir = Join-Path $PSScriptRoot '..\build'
$outPath = Join-Path $outDir 'icon.png'
$customSource = Join-Path $outDir 'icon-source.png'

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Add-Type -AssemblyName System.Drawing

function Save-ResizedPngIcon([string]$srcPath, [string]$dstPath, [int]$size = 512) {
	$src = [System.Drawing.Image]::FromFile($srcPath)
	try {
		$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
		$gfx = [System.Drawing.Graphics]::FromImage($bmp)
		try {
			$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
			$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
			$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
			$gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
			$gfx.Clear([System.Drawing.Color]::Transparent)

			# Fit the source within the target square while preserving aspect ratio.
			$scale = [Math]::Min($size / $src.Width, $size / $src.Height)
			$w = [int]([Math]::Round($src.Width * $scale))
			$h = [int]([Math]::Round($src.Height * $scale))
			$x = [int](($size - $w) / 2)
			$y = [int](($size - $h) / 2)

			$gfx.DrawImage($src, (New-Object System.Drawing.Rectangle($x, $y, $w, $h)))
			$bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
		} finally {
			$gfx.Dispose()
			$bmp.Dispose()
		}
	} finally {
		$src.Dispose()
	}
}

if (Test-Path $customSource) {
	Save-ResizedPngIcon -srcPath $customSource -dstPath $outPath -size 512
	Write-Host "Generated icon from custom source: $customSource -> $outPath" -ForegroundColor Green
	$publicDir = Join-Path $PSScriptRoot '..\public'
	$publicFav = Join-Path $publicDir 'favicon.png'
	New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
	Copy-Item -Path $outPath -Destination $publicFav -Force
	Write-Host "Synced web favicon: $publicFav" -ForegroundColor Green
	exit 0
}

$size = 512
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Background
$bg = [System.Drawing.Brushes]::White
$gfx.FillRectangle($bg, 0, 0, $size, $size)

# Accent circle
$accent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 122, 204))
$gfx.FillEllipse($accent, 36, 36, $size-72, $size-72)

# Simple house shape
$houseBrush = [System.Drawing.Brushes]::White
$roof = New-Object System.Drawing.Point[] 3
$roof[0] = New-Object System.Drawing.Point([int]($size*0.28), [int]($size*0.46))
$roof[1] = New-Object System.Drawing.Point([int]($size*0.50), [int]($size*0.26))
$roof[2] = New-Object System.Drawing.Point([int]($size*0.72), [int]($size*0.46))
$gfx.FillPolygon($houseBrush, $roof)
$gfx.FillRectangle($houseBrush, [int]($size*0.32), [int]($size*0.46), [int]($size*0.36), [int]($size*0.30))

# Door
$doorBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 90, 150))
$gfx.FillRectangle($doorBrush, [int]($size*0.47), [int]($size*0.60), [int]($size*0.08), [int]($size*0.16))

# Text
$font = New-Object System.Drawing.Font('Segoe UI', 64, [System.Drawing.FontStyle]::Bold)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
$gfx.DrawString('AZRAR', $font, $houseBrush, (New-Object System.Drawing.RectangleF(0, [float]($size*0.78), $size, [float]($size*0.18))), $fmt)

$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$gfx.Dispose()
$bmp.Dispose()

Write-Host "Generated icon: $outPath" -ForegroundColor Green

# Same file as web tab icon (index.html /favicon.png) — keeps branding unified.
$publicDir = Join-Path $PSScriptRoot '..\public'
$publicFav = Join-Path $publicDir 'favicon.png'
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
Copy-Item -Path $outPath -Destination $publicFav -Force
Write-Host "Synced web favicon: $publicFav" -ForegroundColor Green
