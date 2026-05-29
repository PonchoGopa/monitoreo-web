const express = require('express');
const { chromium } = require('playwright');

const app = express();

// Lista de páginas a monitorear (modificable)
const paginas = [
    'https://google.com',
    'https://github.com',
    'https://test-123.com' // Agregada a propósito para probar el comportamiento de error/caída
];

app.get('/monitor', async (req, res) => {
    console.log('Iniciando ronda de monitoreo...');
    
    // Lanzamos un único navegador para todo el lote de páginas
    const browser = await chromium.launch({
        headless: true
    });

    let resultados = [];

    try {
        for (const url of paginas) {
            console.log(`Verificando: ${url}`);
            const page = await browser.newPage();
            
            // Configurar viewport responsivo y moderno
            await page.setViewportSize({ width: 1280, height: 800 });

            try {
                const response = await page.goto(url, {
                    waitUntil: 'networkidle',
                    timeout: 25000 // 25 segundos máximo por página
                });

                const status = response.status();
                const titulo = await page.title();
                const contenido = await page.content();

                let erroresDetectados = [];

                // Validaciones de estado HTTP
                if (status !== 200) {
                    erroresDetectados.push(`HTTP Status ${status}`);
                }

                // Validaciones de contenido HTML común de errores
                if (contenido.includes('Internal Server Error')) {
                    erroresDetectados.push('Internal Server Error');
                }
                if (contenido.includes('Access denied')) {
                    erroresDetectados.push('Access denied');
                }
                if (contenido.includes('Fatal Error')) {
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
                    screenshotBase64 // Este string se envía a n8n para adjuntarlo al correo
                });

            } catch (error) {
                console.error(`Error procesando ${url}:`, error.message);
                
                // Si falla la carga, intentamos tomar captura de lo que se haya cargado
                let screenshotBase64 = null;
                try {
                    const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'png' });
                    screenshotBase64 = screenshotBuffer.toString('base64');
                } catch (snapError) {
                    // Si no se puede tomar captura (ej: DNS no resuelto) queda en null
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