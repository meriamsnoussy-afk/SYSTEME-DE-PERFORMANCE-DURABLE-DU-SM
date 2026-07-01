@echo off
setlocal
cd /d "%~dp0"
set PORT=8780

echo.
echo ============================================================
echo  SYSTEME DE PERFORMANCE DURABLE DU SM - SERVEUR RESEAU
echo ============================================================
echo.
echo Ce serveur doit rester ouvert sur le PC principal.
echo Les autres PC du meme reseau ouvriront l'adresse affichee.
echo.

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  node server.js
) else (
  echo Node.js n'est pas installe dans le PATH.
  echo Lancez depuis Codex ou installez Node.js, puis relancez ce fichier.
  pause
)

