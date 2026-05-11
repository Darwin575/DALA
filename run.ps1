# DALA Build & Run Script - Windows Optimized

Write-Host "--- Step 0: Cleaning up ports ---" -ForegroundColor Yellow
$port = 5265
$processes = netstat -ano 2>$null | Select-String ":$port " | ForEach-Object { $_.Split()[-1] }
if ($processes) {
    foreach ($pid in $processes) {
        Write-Host "Port $port is in use. Killing process $pid..." -ForegroundColor Magenta
        taskkill /PID $pid /F /T 2>$null
    }
    Start-Sleep -Seconds 1 # Give the OS a second to release the socket
}

Write-Host "--- Step 1: Building Rust Engine ---" -ForegroundColor Cyan
Set-Location rust_engine
wasm-pack build --target web
if ($LASTEXITCODE -ne 0) { 
    Write-Host "Rust build failed!" -ForegroundColor Red
    exit $LASTEXITCODE 
}
Set-Location ..

Write-Host "--- Step 2: Preparing Assets ---" -ForegroundColor Cyan
$wasmOut = "BlazorHost/wwwroot/js/rust_engine"
if (!(Test-Path $wasmOut)) {
    New-Item -ItemType Directory -Path $wasmOut -Force
}

Copy-Item "rust_engine/pkg/rust_engine_bg.wasm" "$wasmOut/" -Force
Copy-Item "rust_engine/pkg/rust_engine.js" "$wasmOut/" -Force

Write-Host "--- Step 2.5: Preparing DuckDB Assets ---" -ForegroundColor Cyan
npm install
npm run copy-duckdb

Write-Host "--- Step 3: Launching Blazor Host ---" -ForegroundColor Cyan
Set-Location BlazorHost
dotnet watch