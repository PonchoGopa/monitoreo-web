const { chromium } = require('playwright');

async function verificarPagina(url) {

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage();

    try {

        console.log(`Verificando: ${url}`);

        const response = await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        const status = response.status();
        const titulo = await page.title();
        const contenido = await page.content();

        const screenshotName = `screenshot-${Date.now()}.png`;

        await page.screenshot({
            path: screenshotName,
            fullPage: true
        });

        let erroresDetectados = [];

        if (status !== 200) {
            erroresDetectados.push(`HTTP ${status}`);
        }

        if (contenido.includes('Internal Server Error')) {
            erroresDetectados.push('Internal Server Error');
        }

        if (contenido.includes('Access denied')) {
            erroresDetectados.push('Access denied');
        }

        if (contenido.includes('Fatal Error')) {
            erroresDetectados.push('Fatal Error');
        }

        await browser.close();

        return {
            success: erroresDetectados.length === 0,
            url,
            status,
            titulo,
            erroresDetectados,
            screenshotName
        };

    } catch (error) {

        await browser.close();

        return {
            success: false,
            url,
            error: error.message
        };
    }
}

(async () => {

    const paginas = [
        'https://google.com',
        'https://github.com'
    ];

    for (const pagina of paginas) {

        const resultado = await verificarPagina(pagina);

        console.log(JSON.stringify(resultado));
    }

})();