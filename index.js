const puppeteer = require('puppeteer');
const config = require('./util/config');
const logger = require('./util/logger');
const GameMonitor = require('./game/gameMonitor');
const BettingStrategy = require('./game/strategies');
const AuthManager = require('./auth/authManager');
const DashboardServer = require('./server/dashboardServer');
const database = require('./database/database');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to get user input
const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function selectStrategy() {
    console.log('\nAvailable Strategies:');
    console.log('1. Conservative (Lower risk, smaller profits)');
    console.log('2. Moderate (Balanced risk and reward)');
    console.log('3. Aggressive (Higher risk, larger potential profits)');
    console.log('4. Custom (Define your own parameters)\n');

    const choice = await askQuestion('Select strategy (1-4): ');

    switch (choice) {
        case '1':
            return config.BETTING_STRATEGIES.CONSERVATIVE;
        case '2':
            return config.BETTING_STRATEGIES.MODERATE;
        case '3':
            return config.BETTING_STRATEGIES.AGGRESSIVE;
        case '4':
            return await customStrategySetup();
        default:
            logger.warn('Invalid choice, using Moderate strategy');
            return config.BETTING_STRATEGIES.MODERATE;
    }
}

async function customStrategySetup() {
    const strategy = {
        initialBet: parseFloat(await askQuestion('Initial bet amount: ')),
        maxBet: parseFloat(await askQuestion('Maximum bet amount: ')),
        minBet: parseFloat(await askQuestion('Minimum bet amount: ')),
        targetMultiplier: parseFloat(await askQuestion('Target multiplier (e.g., 1.5): ')),
        stopLoss: parseFloat(await askQuestion('Stop loss amount: ')),
        takeProfit: parseFloat(await askQuestion('Take profit amount: ')),
        martingaleMultiplier: parseFloat(await askQuestion('Martingale multiplier (e.g., 2): '))
    };

    // Validate inputs
    if (Object.values(strategy).some(isNaN)) {
        logger.error('Invalid input detected, using Moderate strategy');
        return config.BETTING_STRATEGIES.MODERATE;
    }

    return strategy;
}

async function initializeBrowser() {
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
    return { browser, page };
}

async function setupGracefulShutdown(browser) {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    signals.forEach(signal => {
        process.on(signal, async () => {
            logger.info(`Received ${signal}, shutting down gracefully...`);

            try {
                await DashboardServer.stop();
                await browser.close();
                // database.disconnect();
                logger.info('Cleanup completed');
                rl.close();
                process.exit(0);
            } catch (error) {
                logger.error(`Error during shutdown: ${error.message}`);
                process.exit(1);
            }
        });
    });
}

async function main() {
    try {
        logger.info('Starting Aviator Bot for 888bet...');

        // Start dashboard server
        logger.info('Initializing dashboard...');
        await DashboardServer.start();

        // Get strategy configuration from user
        const strategyConfig = await selectStrategy();
        logger.info('Strategy selected, initializing bot...');

        // Initialize database if needed
        // database.connect();

        const { browser, page } = await initializeBrowser();
        logger.info('Browser initialized');

        // Setup graceful shutdown
        await setupGracefulShutdown(browser);

        // Create auth manager
        const authManager = new AuthManager(page);

        // Interactive login
        console.log('\n=== 888bet Login ===');
        const username = await askQuestion('Username: ');
        const password = await askQuestion('Password: ');

        logger.info('Attempting login...');
        await authManager.login(username, password);

        if (!authManager.isLoggedIn) {
            logger.error('Login failed! Please check credentials and try again.');
            await browser.close();
            rl.close();
            process.exit(1);
        }

        logger.info('Login successful! Navigating to Aviator game...');
        await authManager.navigateToAviator();

        // Wait a moment for game to load
        logger.info('Waiting for game to initialize...');
        await page.waitForTimeout(5000);

        // Create game monitor
        const gameMonitor = new GameMonitor(page, config);
        gameMonitor.strategy = new BettingStrategy(strategyConfig);

        // Setup page error handling
        page.on('error', error => {
            logger.error(`Page error: ${error.message}`);
        });

        page.on('pageerror', error => {
            logger.error(`Page error: ${error.message}`);
        });

        // Start monitoring
        logger.info('Starting game monitoring...');
        logger.info('Strategy Configuration:');
        logger.info(`Initial Bet: ${strategyConfig.initialBet}`);
        logger.info(`Target Multiplier: ${strategyConfig.targetMultiplier}`);
        logger.info(`Stop Loss: ${strategyConfig.stopLoss}`);
        logger.info(`Take Profit: ${strategyConfig.takeProfit}`);

        gameMonitor.startMonitoring();

        // Log balance periodically
        setInterval(async () => {
            const balance = await authManager.getBalance();
            if (balance) {
                logger.info(`Current balance: ${balance.toFixed(2)} MT`);
            }
        }, 60000); // Every minute

    } catch (error) {
        logger.error(`Bot initialization error: ${error.message}`);
        logger.error(error.stack);
        rl.close();
        process.exit(1);
    }
}

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

main().then(() => {
    logger.info('Bot initialization completed');
}).catch(error => {
    logger.error(`Failed to start bot: ${error.message}`);
    process.exit(1);
});