const { chromium } = require('playwright');
const path = require('path');

(async () => {
    console.log('--------------------------------------------------');
    console.log('🚀 Abriendo navegador para iniciar sesión en Cisco Meraki...');
    console.log('--------------------------------------------------');
    
    // Abrimos un navegador visible (headless: false)
    const browser = await chromium.launch({ 
        headless: false,
        args: ['--start-maximized']
    });
    
    const context = await browser.newContext({ 
        viewport: null,
        ignoreHTTPSErrors: true 
    });
    const page = await context.newPage();

    try {
        console.log('Navegando a Cisco Meraki Login...');
        await page.goto('https://dashboard.meraki.com/login', { waitUntil: 'domcontentloaded' });

        console.log('\n👉 ACCIÓN REQUERIDA:');
        console.log('1. Ingresa tu correo y contraseña en la ventana del navegador.');
        console.log('2. Completa tu verificación en dos pasos (2FA / SMS / Authenticator).');
        console.log('3. Espera a que cargue el Dashboard principal.');
        console.log('\n⏳ Esperando a que completes el inicio de sesión (tienes hasta 5 minutos)...\n');

        // Esperamos a que la URL ya no contenga "/login" y estemos dentro del dominio meraki.com
        await page.waitForURL(url => !url.href.includes('/login') && url.href.includes('meraki.com'), {
            timeout: 300000 // 5 minutos máximo
        });

        console.log('Autenticación detectada. Guardando cookies y tokens de sesión...');
        
        // Damos 5 segundos para que terminen de escribirse todas las cookies de sesión
        await page.waitForTimeout(5000);

        const sessionPath = path.join(__dirname, 'meraki-session.json');
        await context.storageState({ path: sessionPath });

        console.log('--------------------------------------------------');
        console.log(`✅ ¡Sesión guardada con éxito en: ${sessionPath}`);
        console.log('A partir de ahora tu monitor web entrará automáticamente al Dashboard.');
        console.log('--------------------------------------------------');

    } catch (error) {
        console.error('❌ Error o tiempo de espera agotado:', error.message);
    } finally {
        await browser.close();
        console.log('Navegador cerrado.');
    }
})();
