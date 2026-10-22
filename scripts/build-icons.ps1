$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$brandPath = Join-Path $PSScriptRoot '..\public\brand'
$source = [System.Drawing.Image]::FromFile((Join-Path $brandPath 'felpautomations-mark.png'))
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngEntries = @()
try {
    foreach ($size in $sizes) {
        $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.DrawImage($source, 0, 0, $size, $size)
            $memory = [System.IO.MemoryStream]::new()
            try {
                $bitmap.Save($memory, [System.Drawing.Imaging.ImageFormat]::Png)
                $bytes = $memory.ToArray()
                [System.IO.File]::WriteAllBytes((Join-Path $brandPath "felpautomations-$size.png"), $bytes)
                $pngEntries += @{ Size = $size; Data = $bytes }
            } finally { $memory.Dispose() }
        } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
    $output = [System.IO.File]::Create((Join-Path $brandPath 'felpautomations.ico'))
    $writer = [System.IO.BinaryWriter]::new($output)
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
        $offset = 6 + 16 * $sizes.Count
        foreach ($entry in $pngEntries) {
            $dimension = if ($entry.Size -eq 256) { 0 } else { $entry.Size }
            $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
            $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$entry.Data.Length); $writer.Write([uint32]$offset)
            $offset += $entry.Data.Length
        }
        foreach ($entry in $pngEntries) { $writer.Write([byte[]]$entry.Data) }
    } finally { $writer.Dispose(); $output.Dispose() }
} finally { $source.Dispose() }
Write-Output 'Ícone ICO e sete tamanhos PNG gerados com transparência.'
