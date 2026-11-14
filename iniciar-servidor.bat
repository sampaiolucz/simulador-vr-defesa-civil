@echo off
REM Abre o simulador no computador (para testar ou projetar no telão).
REM Precisa do Python instalado (python.org). Feche esta janela para desligar.
cd /d "%~dp0"
echo.
echo  Simulador VR - Defesa Civil de Cubatao
echo  Endereco: http://localhost:8080
echo  (feche esta janela para desligar o servidor)
echo.
start "" http://localhost:8080
python -m http.server 8080 2>nul || py -m http.server 8080
pause
