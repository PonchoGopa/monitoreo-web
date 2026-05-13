const express = require('express');
const { chromium } = require('playwright');

const app = express();

app.get('/monitor', async (req, res) => {

    const paginas = [
        'https://test-123.com',
        'https://github.com'
    ];

    let resultados = [];

    for (const url of paginas) {

        const browser = await chromium.launch({
            headless: true
        });

        const page = await browser.newPage();

        try {

            const response = await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            const status = response.status();
            const titulo = await page.title();

            resultados.push({
                success: status === 200,
                url,
                status,
                titulo
            });

        } catch (error) {

            resultados.push({
                success: false,
                url,
                error: error.message
            });

        } finally {

            await browser.close();
        }
    }

    res.json(resultados);
});

app.listen(3000, () => {
    console.log('Servidor monitoreo activo en puerto 3000');
});