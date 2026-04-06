const logger = require('../util/logger');
const config = require('../util/config');

class AuthManager {
    constructor(page) {
        this.page = page;
        this.selectors = config.SELECTORS.LOGIN;
        this.isLoggedIn = false;
    }

    async login(username, password) {
        try {
            logger.info('Navigating to login page...');
            await this.page.goto(config.NAVIGATION.LOGIN_URL, { 
                waitUntil: 'networkidle0',
                timeout: config.NAVIGATION.TIMEOUT 
            });

            // Wait for login form
            await this.page.waitForSelector(this.selectors.USERNAME_INPUT, { 
                timeout: 10000 
            });

            logger.info('Filling login credentials...');
            
            // Fill username
            await this.page.click(this.selectors.USERNAME_INPUT);
            await this.page.keyboard.type(username, { delay: 50 });

            // Fill password
            await this.page.click(this.selectors.PASSWORD_INPUT);
            await this.page.keyboard.type(password, { delay: 50 });

            // Click submit
            logger.info('Submitting login form...');
            await Promise.all([
                this.page.click(this.selectors.SUBMIT_BUTTON),
                this.page.waitForNavigation({ 
                    waitUntil: 'networkidle0',
                    timeout: config.NAVIGATION.TIMEOUT 
                }).catch(() => {
                    logger.warn('Navigation timeout, but continuing...');
                })
            ]);

            // Check if login was successful
            await this.checkLoginStatus();

        } catch (error) {
            logger.error(`Login error: ${error.message}`);
            throw error;
        }
    }

    async checkLoginStatus() {
        try {
            const currentUrl = this.page.url();
            logger.info(`Current URL after login: ${currentUrl}`);

            // Check for balance element (indicates successful login)
            const balanceElement = await this.page.$(config.SELECTORS.SITE.BALANCE_HEADER);
            if (balanceElement) {
                const balance = await balanceElement.evaluate(el => el.textContent);
                logger.info(`Login successful! Balance: ${balance}`);
                this.isLoggedIn = true;
                return true;
            }

            // Check for error message
            const errorElement = await this.page.$(this.selectors.ERROR_MESSAGE);
            if (errorElement) {
                const errorMessage = await errorElement.evaluate(el => el.textContent);
                logger.error(`Login failed: ${errorMessage}`);
                this.isLoggedIn = false;
                return false;
            }

            // Assume success if no error
            logger.info('Login appears successful (no error detected)');
            this.isLoggedIn = true;
            return true;

        } catch (error) {
            logger.warn(`Could not verify login status: ${error.message}`);
            this.isLoggedIn = true; // Assume success
            return true;
        }
    }

    async navigateToAviator() {
        try {
            logger.info('Navigating to Aviator game...');
            await this.page.goto(config.NAVIGATION.AVIATOR_URL, { 
                waitUntil: 'networkidle0',
                timeout: config.NAVIGATION.TIMEOUT 
            });

            // Wait for game to load
            await this.page.waitForSelector(config.SELECTORS.AVIATOR.BUBBLE_MULTIPLIER, { 
                timeout: 30000 
            }).catch(() => {
                logger.warn('Game frame not found, trying alternative selectors...');
            });

            logger.info('Aviator game page loaded');
            return true;

        } catch (error) {
            logger.error(`Error navigating to Aviator: ${error.message}`);
            throw error;
        }
    }

    async getBalance() {
        try {
            const balanceElement = await this.page.$(config.SELECTORS.SITE.BALANCE_HEADER);
            if (balanceElement) {
                const balanceText = await balanceElement.evaluate(el => el.textContent);
                return parseFloat(balanceText.replace(/[^0-9.-]+/g, ''));
            }
            return null;
        } catch (error) {
            logger.error(`Error getting balance: ${error.message}`);
            return null;
        }
    }

    async logout() {
        try {
            logger.info('Logging out...');
            // Click user menu
            await this.page.click(config.SELECTORS.SITE.MENU_BUTTON);
            
            // Wait for logout button and click
            await this.page.waitForSelector('a[href*="logout"]');
            await this.page.click('a[href*="logout"]');
            
            await this.page.waitForNavigation({ 
                waitUntil: 'networkidle0',
                timeout: 10000 
            });

            this.isLoggedIn = false;
            logger.info('Logged out successfully');

        } catch (error) {
            logger.error(`Logout error: ${error.message}`);
        }
    }
}

module.exports = AuthManager;
