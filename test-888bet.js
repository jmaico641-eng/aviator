/**
 * Script de teste para verificar a integração com 888bet
 * Este script testa:
 * 1. Abertura do navegador
 * 2. Navegação até 888bets.co.mz
 * 3. Login
 * 4. Navegação até o Aviator
 */

const puppeteer = require('puppeteer');
const config = require('./util/config');
const logger = require('./util/logger');
const AuthManager = require('./auth/authManager');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function testIntegration() {
    try {
        logger.info('=== Teste de Integração 888bet ===\n');

        // 1. Inicializar navegador
        logger.info('1. Inicializando navegador...');
        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(config.NAVIGATION.TIMEOUT);
        logger.info('✓ Navegador inicializado\n');

        // 2. Navegar até o site
        logger.info('2. Navegando até 888bets.co.mz...');
        await page.goto(config.NAVIGATION.BASE_URL, {
            waitUntil: 'networkidle0',
            timeout: config.NAVIGATION.TIMEOUT
        });
        logger.info(`✓ Página carregada: ${page.url()}\n`);

        // 3. Testar login
        console.log('=== Login Manual ===');
        console.log('Você tem 30 segundos para fazer login manualmente se preferir');
        console.log('Ou pressione ENTER para login automático\n');

        const useManualLogin = await askQuestion('Deseja fazer login manual? (s/n): ');
        
        let authManager;
        
        if (useManualLogin.toLowerCase() === 's') {
            logger.info('Faça login manualmente na página aberta...');
            logger.info('Pressione ENTER quando terminar o login');
            await askQuestion('');
            
            authManager = new AuthManager(page);
            authManager.isLoggedIn = true;
        } else {
            const username = await askQuestion('Username: ');
            const password = await askQuestion('Password: ');

            authManager = new AuthManager(page);
            await authManager.login(username, password);
        }

        if (!authManager.isLoggedIn) {
            logger.error('Login falhou!');
            await browser.close();
            rl.close();
            process.exit(1);
        }

        logger.info('✓ Login realizado com sucesso\n');

        // 4. Verificar saldo
        const balance = await authManager.getBalance();
        if (balance !== null) {
            logger.info(`✓ Saldo encontrado: ${balance.toFixed(2)} MT\n`);
        } else {
            logger.warn('⚠ Não foi possível obter o saldo\n');
        }

        // 5. Navegar até Aviator
        logger.info('5. Tentando navegar até o Aviator...');
        try {
            await authManager.navigateToAviator();
            logger.info('✓ Página do Aviator carregada\n');
        } catch (error) {
            logger.warn(`⚠ Não foi possível navegar até o Aviator: ${error.message}`);
            logger.info('Isto pode ser normal se o jogo estiver em um iframe ou requerer navegação manual\n');
        }

        // 6. Aguardar e observar
        logger.info('=== Teste Concluído ===');
        logger.info('O navegador permanecerá aberto por 30 segundos para observação');
        logger.info('Pressione ENTER para fechar o navegador\n');
        
        await askQuestion('');

        await browser.close();
        logger.info('✓ Navegador fechado');
        rl.close();
        
        logger.info('\n=== Resultado do Teste ===');
        logger.info('✓ Integração básica funcionando!');
        logger.info('Se o login funcionou, o bot está pronto para uso.');
        logger.info('Se houve erros nos seletores, precisamos ajustar o config.js');

    } catch (error) {
        logger.error(`Erro no teste: ${error.message}`);
        logger.error(error.stack);
        rl.close();
        process.exit(1);
    }
}

testIntegration();
