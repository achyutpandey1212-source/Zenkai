$src = "c:\Users\Achyut\Desktop\vibe2ship\src\app\api\chat\route.ts"
$content = Get-Content $src
$trimmed = $content | Select-Object -First 354
$trimmed | Set-Content $src -Encoding UTF8
Write-Host "Done. Lines in file: $(($trimmed).Count)"
