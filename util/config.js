const config = {
    NAVIGATION: {
        BASE_URL: 'https://888bets.co.mz',
        LOGIN_URL: 'https://888bets.co.mz/pt/auth/login',
        AVIATOR_URL: 'https://888bets.co.mz/pt/game/aviator',
        TIMEOUT: 60000,
        RUN_DURATION: 24 * 60 * 60 * 1000 // 24 hours
    },
    GAME: {
        POLLING_INTERVAL: 4000,
        MULTIPLIER_THRESHOLD: 1.50,
        HISTORY_SIZE: 3  // Number of previous games to consider for average multiplier
    },
    SELECTORS: {
        LOGIN: {
            USERNAME_INPUT: 'input[name="login"]',
            PASSWORD_INPUT: 'input[name="password"]',
            SUBMIT_BUTTON: 'button[type="submit"]',
            ERROR_MESSAGE: '.login-error'
        },
        AVIATOR: {
            GAME_FRAME: 'iframe[class*="aviator"]',
            BUBBLE_MULTIPLIER: '.payouts-wrapper .bubble-multiplier',
            BALANCE: '.balance .amount',
            BET_BUTTON: 'div.buttons-block > button.btn.btn-success.bet.ng-star-inserted',
            CASHOUT_BUTTON: 'button.cashout.ng-star-inserted',
            BET_INPUT: 'input[inputmode="decimal"]',
            CASHOUT_MULTIPLIER: '.amount span:first-child',
            DEMO_BUTTON: '.btn-demo',
            PLAY_BUTTON: '.btn-play'
        },
        SITE: {
            BALANCE_HEADER: '.user-balance',
            DEPOSIT_BUTTON: '.btn-deposit',
            MENU_BUTTON: '.user-menu'
        }
    },
    DATABASE: {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'aviatorBot'
    },
    BETTING_STRATEGIES: {
        CONSERVATIVE: {
            initialBet: 1.00,
            maxBet: 50.00,
            minBet: 1.00,
            targetMultiplier: 1.20,
            stopLoss: 20.00,
            takeProfit: 40.00,
            martingaleMultiplier: 1.5,
            averageMultiplierThreshold: 1.50
        },
        MODERATE: {
            initialBet: 2.00,
            maxBet: 100.00,
            minBet: 1.00,
            targetMultiplier: 1.50,
            stopLoss: 50.00,
            takeProfit: 100.00,
            martingaleMultiplier: 2,
            averageMultiplierThreshold: 2.00
        },
        AGGRESSIVE: {
            initialBet: 5.00,
            maxBet: 200.00,
            minBet: 1.00,
            targetMultiplier: 2.00,
            stopLoss: 100.00,
            takeProfit: 300.00,
            martingaleMultiplier: 2.5,
            averageMultiplierThreshold: 3.00
        }
    }
};

module.exports = config;