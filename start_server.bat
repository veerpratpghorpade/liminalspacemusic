@echo off
title DarkBeat Server
cls
echo ========================================
echo   DarkBeat Server Starting...
echo ========================================
echo.

:: Go to the workspace folder
cd /d "C:\Users\HP\Documents\kimi\workspace"

:: Try Python first, if not available use PowerShell
python start_server.py 2>nul
if %errorlevel% equ 0 goto done

echo Python not found. Using PowerShell instead...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "
$port = 8080;
Write-Host 'Starting server on port ' $port '...' -ForegroundColor Green;

$listener = New-Object System.Net.HttpListener;
$listener.Prefixes.Add('http://localhost:'+$port+'/');
try {
    $listener.Start();
} catch {
    Write-Host 'ERROR: ' $_.Exception.Message -ForegroundColor Red;
    Write-Host 'Press any key to exit...';
    $host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') | Out-Null;
    exit;
}

Write-Host '';
Write-Host '========================================' -ForegroundColor Green;
Write-Host '  DARKBEAT SERVER IS RUNNING!' -ForegroundColor Green;
Write-Host '========================================' -ForegroundColor Green;
Write-Host '';

$localUrl = 'http://localhost:' + $port;
Write-Host '  Open on this PC:    ' -NoNewline;
Write-Host $localUrl -ForegroundColor Cyan;

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -notlike '0.0.*' } | Select-Object -First 1).IPAddress;
if ($ip) {
    $phoneUrl = 'http://' + $ip + ':' + $port;
    Write-Host '  Open on your phone: ' -NoNewline;
    Write-Host $phoneUrl -ForegroundColor Cyan;
}

Write-Host '';
Write-Host '  Press Ctrl+C to stop the server' -ForegroundColor Yellow;
Write-Host '========================================' -ForegroundColor Green;
Write-Host '';

$mimeMap = @{
    '.html' = 'text/html';
    '.css'  = 'text/css';
    '.js'   = 'application/javascript';
    '.json' = 'application/json';
    '.png'  = 'image/png';
    '.jpg'  = 'image/jpeg';
    '.jpeg' = 'image/jpeg';
    '.svg'  = 'image/svg+xml';
    '.ico'  = 'image/x-icon';
    '.mp3'  = 'audio/mpeg';
    '.ogg'  = 'audio/ogg';
};

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext();
        $urlPath = $ctx.Request.Url.LocalPath;
        $localPath = if ($urlPath -eq '/') { Join-Path (Get-Location) 'index.html' } else { Join-Path (Get-Location) ($urlPath.TrimStart('/').Replace('/','\')) };

        if (Test-Path $localPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower();
            $mime = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { 'application/octet-stream' };
            $bytes = [System.IO.File]::ReadAllBytes($localPath);
            $ctx.Response.ContentType = $mime;
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length);
        } else {
            $ctx.Response.StatusCode = 404;
            $bytes = [System.Text.Encoding]::UTF8]::GetBytes('<h1>404 - Not Found</h1>');
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length);
        }
        $ctx.Response.Close();
    } catch { break }
}

$listener.Stop();
Write-Host 'Server stopped.';
Write-Host 'Press any key to exit...';
$host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') | Out-Null;
"

:done
echo.
echo Server stopped.
pause
