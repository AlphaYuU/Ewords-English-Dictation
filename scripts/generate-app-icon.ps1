Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$buildDir = Join-Path $root "build"
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngPaths = @()

function Draw-Icon {
  param([int] $Size)

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::White)

  $fontSize = [Math]::Floor($Size * 0.72)
  $font = New-Object System.Drawing.Font "Segoe UI", $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 24, 24, 24))
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center

  $rect = [System.Drawing.RectangleF]::new(0, -($Size * 0.02), $Size, $Size)
  $graphics.DrawString("E", $font, $brush, $rect, $format)

  if ($Size -ge 32) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 226, 226, 226)), ([Math]::Max(1, $Size / 96))
    $graphics.DrawRectangle($pen, 0, 0, $Size - 1, $Size - 1)
    $pen.Dispose()
  }

  $format.Dispose()
  $brush.Dispose()
  $font.Dispose()
  $graphics.Dispose()

  return $bitmap
}

foreach ($size in $sizes) {
  $bitmap = Draw-Icon $size
  $pngPath = Join-Path $buildDir "icon-$size.png"
  $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
  if ($size -eq 256) {
    $bitmap.Save((Join-Path $buildDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $bitmap.Dispose()
  $pngPaths += $pngPath
}

$icoPath = Join-Path $buildDir "icon.ico"
$writer = New-Object System.IO.BinaryWriter ([System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create))
try {
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$pngPaths.Count)

  $offset = 6 + (16 * $pngPaths.Count)
  $entries = @()
  foreach ($pngPath in $pngPaths) {
    $bytes = [System.IO.File]::ReadAllBytes($pngPath)
    $size = [int]([System.IO.Path]::GetFileNameWithoutExtension($pngPath).Split("-")[1])
    $entries += @{ Size = $size; Bytes = $bytes; Offset = $offset }
    $offset += $bytes.Length
  }

  foreach ($entry in $entries) {
    $encodedSize = if ($entry.Size -eq 256) { 0 } else { $entry.Size }
    $writer.Write([byte]$encodedSize)
    $writer.Write([byte]$encodedSize)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$entry.Bytes.Length)
    $writer.Write([UInt32]$entry.Offset)
  }

  foreach ($entry in $entries) {
    $writer.Write($entry.Bytes)
  }
}
finally {
  $writer.Close()
}

Write-Host "Generated $icoPath"
