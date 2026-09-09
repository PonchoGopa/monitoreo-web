const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const app = express();

// Lista de páginas a monitorear (modificable)
const paginas = [
    'https://n127.dashboard.meraki.com/IRAPUATO/n/HVi19a_b/manage/nodes/new_list/overview?from=wireless%20overview&healthT0=1788364437.491&healthT1=1788368037.491',
    'http://192.168.0.110/',
    'http://192.168.0.42/',
    'http://192.168.0.43/',
    'http://192.168.0.213:6600/login',
    'http://192.168.0.213:8080/',
    'http://192.168.0.213:8501/'
];

app.get('/monitor', async (req, res) => {
    console.log('Iniciando ronda de monitoreo...');

    // Lanzamos un único navegador para todo el lote de páginas
    const browser = await chromium.launch({
        headless: true
    });

    let resultados = [];

    // Verificamos si existe sesión guardada de Meraki
    const sessionFile = path.join(__dirname, 'meraki-session.json');
    const hasSession = fs.existsSync(sessionFile);

    const contextOptions = {
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: true // Permite entrar a impresoras y dispositivos locales con HTTPS autofirmado / No Seguro
    };

    if (hasSession) {
        contextOptions.storageState = sessionFile;
        console.log('🔐 Cargando sesión autenticada de Cisco Meraki (meraki-session.json)...');
    }

    const context = await browser.newContext(contextOptions);

    try {
        for (const url of paginas) {
            console.log(`Verificando: ${url}`);
            const page = await context.newPage();

            try {
                // Usamos domcontentloaded para que no se quede colgado esperando conexiones continuas (WebSockets/Polling de Meraki)
                const response = await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 40000 // 40 segundos
                });

                // Si es un dashboard interactivo como Meraki, damos tiempo para que rendericen los componentes y gráficas
                if (url.includes('meraki.com')) {
                    await page.waitForTimeout(6000);
                } else {
                    await page.waitForTimeout(1000);
                }

                const status = response ? response.status() : 200;
                const titulo = await page.title();
                const currentUrl = page.url();

                // Obtenemos solo el texto visible en pantalla (para evitar falsos positivos dentro de archivos JS o scripts)
                let textoVisible = '';
                try {
                    textoVisible = await page.locator('body').innerText({ timeout: 5000 });
                } catch (e) {
                    textoVisible = await page.content();
                }

                let erroresDetectados = [];

                // Validación de sesión en Meraki (si nos manda a login)
                if (url.includes('meraki.com') && (currentUrl.includes('/login') || titulo.toLowerCase().includes('log in'))) {
                    erroresDetectados.push('Sesión de Meraki no iniciada o expirada. Ejecuta "node login-meraki.js" para renovarla.');
                }

                // Validaciones de estado HTTP
                if (status && status >= 400) {
                    erroresDetectados.push(`HTTP Status ${status}`);
                }

                // Validaciones de texto de error real visible en pantalla
                if (textoVisible.includes('500 Internal Server Error') || textoVisible.includes('502 Bad Gateway') || textoVisible.includes('503 Service Unavailable')) {
                    erroresDetectados.push('Error en Servidor (500 / 502 / 503)');
                }
                if (textoVisible.includes('Access Denied') && !url.includes('meraki.com')) {
                    erroresDetectados.push('Acceso Denegado (Access Denied)');
                }
                if (textoVisible.includes('Fatal error:')) {
                    erroresDetectados.push('Fatal Error');
                }

                // Capturamos la pantalla directamente en memoria (Buffer) y la convertimos a Base64
                const screenshotBuffer = await page.screenshot({
                    fullPage: true,
                    type: 'png'
                });
                const screenshotBase64 = screenshotBuffer.toString('base64');

                resultados.push({
                    success: erroresDetectados.length === 0,
                    url,
                    status,
                    titulo,
                    erroresDetectados,
                    screenshotBase64
                });

            } catch (error) {
                console.error(`Error procesando ${url}:`, error.message);
                
                // Si falla la carga, renderizamos una tarjeta de error limpia
                let screenshotBase64 = null;
                try {
                    const errorPage = await browser.newPage();
                    await errorPage.setViewportSize({ width: 1000, height: 600 });
                    await errorPage.setContent(`
                        <html>
                          <body style="font-family: Arial, sans-serif; background-color: #1a1a1a; color: #ffffff; padding: 40px; text-align: center;">
                            <h1 style="color: #ff4d4f; font-size: 26px;">⚠️ Fallo de Conexión / Monitoreo</h1>
                            <h2 style="color: #cccccc; font-weight: normal; word-break: break-all;">${url}</h2>
                            <div style="background: #2a2a2a; border-left: 4px solid #ff4d4f; padding: 20px; border-radius: 6px; display: inline-block; margin-top: 20px; text-align: left; max-width: 700px;">
                              <p style="color: #ff7875; font-family: Consolas, monospace; margin: 0; font-size: 14px;">${error.message}</p>
                            </div>
                            <p style="margin-top: 25px; color: #777777; font-size: 12px;">Captura generada automáticamente por el monitor de inicio de turno.</p>
                          </body>
                        </html>
                    `);
                    const screenshotBuffer = await errorPage.screenshot({ fullPage: true, type: 'png' });
                    screenshotBase64 = screenshotBuffer.toString('base64');
                    await errorPage.close();
                } catch (snapError) {
                    console.error('No se pudo generar captura de error:', snapError.message);
                }

                resultados.push({
                    success: false,
                    url,
                    status: null,
                    titulo: 'Error de Conexión',
                    erroresDetectados: [error.message],
                    screenshotBase64
                });

            } finally {
                // Cerramos la pestaña individual pero mantenemos el navegador abierto
                await page.close();
            }
        }
    } catch (globalError) {
        console.error('Error global en el monitor:', globalError.message);
    } finally {
        // Cerramos el navegador al finalizar todo el lote
        await browser.close();
    }

    console.log('Ronda de monitoreo completada.');
    res.json(resultados);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor monitoreo activo en puerto ${PORT}`);
});