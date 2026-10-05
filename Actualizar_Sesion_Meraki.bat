@echo off
title Actualizar Sesion Cisco Meraki
cd /d "%~dp0"

echo ========================================================
echo       ACTUALIZADOR DE SESION CISCO MERAKI
echo ========================================================
echo.
echo Se abrira una ventana de navegador.
echo 1. Ingresa tu correo y contrasena de Cisco Meraki.
echo 2. Introduce el codigo de verificacion (2FA / SMS).
echo 3. Recuerda marcar la casilla de "Recordar este equipo por 30 dias".
echo 4. Espera a que cargue el Dashboard y la ventana se cerrara sola.
echo.
echo ========================================================
echo.

node login-meraki.js

echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
