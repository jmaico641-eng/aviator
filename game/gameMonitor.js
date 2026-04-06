const BettingStrategy = require("./strategies");
const StatsTracker = require("./statsTracker");
const BetManager = require("./betManager");
const FrameHelper = require("../util/frameHelper");
const AviatorPredictor = require("../prediction/aviatorPredictor");
const RNGReader = require("../rng/rngReader");
const NeuralNetworkPredictor = require("../ml/neuralNetwork");
const ScikitLearnML = require("../ml/sklearnIntegration");
const TimingAttackAnalyzer = require("../analysis/timingAttack");
const DataCollector = require("../data/dataCollector");
const DashboardServer = require("../server/dashboardServer");
const logger = require("../util/logger");

class GameMonitor {
    constructor(page, config) {
        this.page = page;
        this.config = config;
        this.strategy = new BettingStrategy(config.BETTING_STRATEGIES.AGGRESSIVE);
        this.statsTracker = new StatsTracker();
        this.predictor = new AviatorPredictor({ maxHistory: 100 });
        this.rngReader = new RNGReader({ minSamples: 50, bins: 10, maxHistory: 1000 });
        this.neuralNetwork = new NeuralNetworkPredictor({ 
            sequenceLength: 20, 
            epochs: 50,
            learningRate: 0.001
        });
        this.scikitLearn = ScikitLearnML;
        this.timingAnalyzer = new TimingAttackAnalyzer({ minSamples: 100, maxHistory: 5000 });
        this.dataCollector = DataCollector;
        this.betManager = new BetManager(config, this.strategy, this.statsTracker);
        this.previousMultiplier = null;
        this.multiplierHistory = [];
        this.historySize = config.GAME.HISTORY_SIZE;
        this.roundCounter = 0;
        this._mlTrainCounter = 0;
        this.gameState = {
            inProgress: false,
            lastCrashPoint: null,
            betPlaced: false
        };
        
        // Inicializa coletor de dados
        this.dataCollector.initialize().catch(err => {
            logger.error(`Erro ao inicializar data collector: ${err.message}`);
        });
        
        // Verifica disponibilidade do Scikit-Learn
        this.scikitLearn.checkAvailability().then(available => {
            if (available) {
                logger.info('🐍 Scikit-Learn pronto para uso!');
            } else {
                logger.warn('⚠️ Scikit-Learn não disponível, apenas TensorFlow.js será usado');
            }
        });
    }

    isGameEnd(currentMultiplier) {
        if (!currentMultiplier || !this.previousMultiplier) return false;

        // If current multiplier is different from previous, game has ended
        return currentMultiplier !== this.previousMultiplier;
    }

    /**
     * Calculate the average multiplier from the last N games
     */
    calculateAverageMultiplier() {
        if (this.multiplierHistory.length === 0) return 0;
        const sum = this.multiplierHistory.reduce((acc, val) => acc + val, 0);
        return sum / this.multiplierHistory.length;
    }

    async getGameState(frame) {
        try {
            // Get multiplier value - try multiple selectors for 888bet
            let bubbleValue = null;
            const selectors = [
                this.config.SELECTORS.AVIATOR.BUBBLE_MULTIPLIER,
                '.multiplier-value',
                '.game-multiplier',
                '[class*="multiplier"]'
            ];

            for (const selector of selectors) {
                try {
                    bubbleValue = await frame.evaluate((selector) => {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length === 0) return null;
                        const element = elements[0];
                        const value = element.textContent.trim();
                        // Remove 'x' suffix if present
                        return value ? parseFloat(value.replace('x', '')) : null;
                    }, selector);
                    
                    if (bubbleValue) break;
                } catch (e) {
                    continue;
                }
            }

            // Check for bet button
            const betButton = await frame.evaluate((selector) => {
                const button = document.querySelector(selector);
                if (!button) return { exists: false };
                const boundingBox = button.getBoundingClientRect();
                return {
                    exists: true,
                    text: button.textContent.trim().toLowerCase(),
                    disabled: button.disabled || false,
                    visible: boundingBox.width > 0 && boundingBox.height > 0
                };
            }, this.config.SELECTORS.AVIATOR.BET_BUTTON);

            // Get balance
            const balance = await frame.evaluate((selector) => {
                const el = document.querySelector(selector);
                return el ? parseFloat(el.textContent.replace(/[^0-9.-]+/g, '')) : null;
            }, this.config.SELECTORS.AVIATOR.BALANCE);

            return {
                multiplier: bubbleValue,
                betButton,
                balance,
                formattedBalance: balance ? balance.toFixed(2) : '0.00'
            };
        } catch (error) {
            logger.error(`Error getting game state: ${error.message}`);
            return null;
        }
    }

    async monitorGame() {
        try {
            // Try to find game in main page or iframe
            let frame = null;
            
            // First try main page
            try {
                frame = await FrameHelper.waitForSelectorInFrames(
                    this.page,
                    this.config.SELECTORS.AVIATOR.BUBBLE_MULTIPLIER
                );
            } catch (e) {
                // Try iframe selectors
                logger.debug('Trying iframe search for game elements...');
                for (const iframe of this.page.frames()) {
                    try {
                        const multiplierEl = await iframe.$(this.config.SELECTORS.AVIATOR.BUBBLE_MULTIPLIER);
                        if (multiplierEl) {
                            frame = iframe;
                            logger.info('Found game in iframe');
                            break;
                        }
                    } catch (err) {
                        continue;
                    }
                }
            }

            if (!frame) {
                logger.debug('Game frame not found yet');
                return;
            }

            const gameState = await this.getGameState(frame);
            if (!gameState) return;

            // Detect game end based on multiplier change
            if (this.isGameEnd(gameState.multiplier)) {
                this.roundCounter++;
                logger.info(`Game ended at ${this.previousMultiplier}x, new game starting at ${gameState.multiplier}x (Round #${this.roundCounter})`);

                // Handle bet result first
                if (this.betManager.isWaitingForResult) {
                    this.betManager.handleGameCrash(this.previousMultiplier);
                    
                    // Avalia a previsão anterior
                    const accuracy = this.predictor.evaluatePrediction(this.previousMultiplier);
                    
                    // Salva previsão no banco
                    this.dataCollector.savePrediction({
                        roundId: `round_${this.roundCounter}`,
                        predicted: this._lastPrediction?.predicted || 0,
                        actual: this.previousMultiplier,
                        confidence: this._lastPrediction?.confidence || 0,
                        accuracy: accuracy,
                        methods: this._lastPrediction?.methods || [],
                        rngScore: 0
                    });
                    
                    // Envia resultado para o dashboard
                    const history = this.predictor.accuracy.predictions.slice(-20);
                    DashboardServer.broadcastHistory(history);
                    
                    // Feedback para rede neural
                    const allMultipliers = this.rngReader.data;
                    if (allMultipliers.length >= 21) {
                        this.neuralNetwork.addFeedback(allMultipliers, this.previousMultiplier);
                    }
                }

                // Update history with the completed game
                if (this.previousMultiplier) {
                    this.multiplierHistory.unshift(this.previousMultiplier);
                    if (this.multiplierHistory.length > this.historySize) {
                        this.multiplierHistory.pop();
                    }
                    logger.info(`Updated multiplier history: [${this.multiplierHistory.join(', ')}]`);
                    
                    // Adiciona ao histórico do predictor
                    this.predictor.addObservation(this.previousMultiplier);
                    
                    // Adiciona ao RNG Reader
                    this.rngReader.addObservation(this.previousMultiplier, Date.now());
                    
                    // Registra timing
                    this.timingAnalyzer.recordRound({
                        roundId: `round_${this.roundCounter}`,
                        multiplier: this.previousMultiplier,
                        timestamp: Date.now()
                    });
                    
                    // Salva NO BANCO DE DADOS
                    this.dataCollector.saveRound({
                        roundId: `round_${this.roundCounter}`,
                        multiplier: this.previousMultiplier,
                        timestamp: Date.now(),
                        clientSeed: null, // Se disponível na página
                        serverSeedHash: null,
                        nonce: this.roundCounter,
                        duration: null,
                        gapToNext: null
                    });
                    
                    // Treina Scikit-Learn a cada 50 rodadas
                    this._mlTrainCounter++;
                    if (this._mlTrainCounter >= 50 && this.rngReader.data.length >= 100) {
                        this._mlTrainCounter = 0;
                        logger.info('\n🐍 Iniciando treino Scikit-Learn...');
                        
                        // Treina em background (não bloqueante)
                        this.scikitLearn.trainModels([...this.rngReader.data])
                            .then(result => {
                                if (result) {
                                    logger.info('✅ Scikit-Learn treino concluído!');
                                }
                            })
                            .catch(err => {
                                logger.error(`Erro treino Scikit-Learn: ${err.message}`);
                            });
                    }
                }

                this.gameState.inProgress = false;
                this.gameState.lastCrashPoint = this.previousMultiplier;
                this.gameState.betPlaced = false;
            }

            // Calculate average including current game's multiplier
            let currentHistory = [...this.multiplierHistory];
            if (gameState.multiplier) {
                currentHistory.unshift(gameState.multiplier);
                if (currentHistory.length > this.historySize) {
                    currentHistory.pop();
                }
            }
            const avgMultiplier = currentHistory.reduce((acc, val) => acc + val, 0) / currentHistory.length;
            const averageThreshold = this.strategy.averageMultiplierThreshold;

            // Faz previsão estatística
            const prediction = this.predictor.predict();
            
            // Faz previsão com Scikit-Learn (se disponível)
            let mlPrediction = null;
            if (this.scikitLearn.isAvailable && this.rngReader.data.length >= 50) {
                try {
                    mlPrediction = await this.scikitLearn.predict([...this.rngReader.data]);
                    if (mlPrediction) {
                        logger.info('🐍 SCIKIT-LEARN:');
                        logger.info(`   Classificação: ${mlPrediction.classification?.recommendation} (${(mlPrediction.classification?.confidence * 100).toFixed(1)}%)`);
                        logger.info(`   Regressão: ${mlPrediction.regression?.predicted_value?.toFixed(2) || 'N/A'}x (R²: ${(mlPrediction.regression?.r2_score * 100).toFixed(1) || 0}%)`);
                    }
                } catch (err) {
                    logger.debug(`Erro previsão ML: ${err.message}`);
                }
            }
            
            // Faz previsão com Neural Network
            let nnPrediction = null;
            if (this.neuralNetwork.isTrained) {
                nnPrediction = this.neuralNetwork.predict(this.rngReader.data);
            }
            
            // Análise RNG (a cada 10 ciclos para não sobrecarregar)
            let rngAnalysis = null;
            if (!this._rngCounter) this._rngCounter = 0;
            this._rngCounter++;
            
            if (this._rngCounter >= 10 && this.rngReader.data.length >= this.rngReader.minSamples) {
                rngAnalysis = this.rngReader.analyze();
                this._rngCounter = 0;
                
                logger.info('🔍 ANÁLISE RNG:');
                logger.info(`   Score: ${rngAnalysis.randomnessScore.score}/100 - ${rngAnalysis.randomnessScore.quality}`);
                logger.info(`   Entropia: ${(rngAnalysis.entropy.shannonNormalized * 100).toFixed(1)}%`);
                logger.info(`   ${rngAnalysis.entropy.interpretation}`);
                
                if (rngAnalysis.bias.hasBias) {
                    logger.warn(`   ⚠️ Bias detectado: ${rngAnalysis.bias.interpretation}`);
                }
                
                if (rngAnalysis.markov.hasStrongPattern) {
                    logger.warn(`   ⚠️ Padrão Markov: ${rngAnalysis.markov.interpretation}`);
                }
            }

            logger.info(`Current game: ${gameState.multiplier}x | History: [${currentHistory.join(', ')}] | Average: ${avgMultiplier.toFixed(2)}x vs threshold: ${averageThreshold}`);
            logger.info(`🔮 PREVISÃO: ${prediction.predicted ? prediction.predicted.toFixed(2) + 'x' : 'N/A'} | Confiança: ${(prediction.confidence * 100).toFixed(1)}% | ${prediction.recommendation}`);
            logger.info(`   → ${prediction.reason}`);

            // Envia previsão para o dashboard
            if (rngAnalysis) {
                DashboardServer.broadcastPrediction({ ...prediction, rngAnalysis });
            } else {
                DashboardServer.broadcastPrediction(prediction);
            }

            // Envia estatísticas atualizadas a cada 5 ciclos
            if (!this._statsCounter) this._statsCounter = 0;
            this._statsCounter++;
            if (this._statsCounter >= 5) {
                const accuracy = this.predictor.getAccuracyStats();
                const stats = this.statsTracker.getStats();
                const summary = this.predictor.getSummary();
                
                DashboardServer.broadcastStats({
                    accuracy,
                    statistics: summary.statistics,
                    betStats: stats
                });
                
                this._statsCounter = 0;
            }

            // Check if we should place a bet based on ALL predictions
            if (!this.gameState.betPlaced &&
                gameState.betButton.exists &&
                gameState.betButton.visible &&
                !gameState.betButton.disabled &&
                this.multiplierHistory.length >= (this.historySize - 1)) {

                // Combina todas as previsões
                let shouldBet = false;
                let confidence = 0;
                let reason = '';

                // Precisa de pelo menos 2 fontes concordando
                let agreeCount = 0;
                let totalSources = 0;

                // Fonte 1: Statistical Predictor
                if (prediction.recommendation && prediction.recommendation.startsWith('APOSTAR')) {
                    agreeCount++;
                    confidence = prediction.confidence;
                    reason = prediction.reason;
                }
                totalSources++;

                // Fonte 2: Scikit-Learn
                if (mlPrediction && mlPrediction.classification) {
                    totalSources++;
                    if (mlPrediction.classification.recommendation === 'APOSTAR') {
                        agreeCount++;
                        confidence = Math.max(confidence, mlPrediction.classification.confidence);
                        reason = `Scikit-Learn: ${(mlPrediction.classification.confidence * 100).toFixed(0)}% confiança`;
                    }
                }

                // Fonte 3: Neural Network
                if (nnPrediction) {
                    totalSources++;
                    if (nnPrediction.confidence > 0.6) {
                        agreeCount++;
                        confidence = Math.max(confidence, nnPrediction.confidence);
                        reason = `Neural Network: ${(nnPrediction.confidence * 100).toFixed(0)}% confiança`;
                    }
                }

                // Decide: precisa de pelo menos 50% das fontes concordando
                const agreementRatio = agreeCount / totalSources;
                shouldBet = agreementRatio >= 0.5 && confidence > 0.6;

                if (shouldBet) {
                    logger.info(`💰 OPORTUNIDADE DETECTADA! ${reason}`);
                    logger.info(`   Concordância: ${agreeCount}/${totalSources} fontes (${(agreementRatio * 100).toFixed(0)}%)`);
                    logger.info(`   Confiança: ${(confidence * 100).toFixed(1)}%`);
                    
                    const success = await this.betManager.placeBet(this.page);
                    if (success) {
                        this.gameState.betPlaced = true;
                        this.gameState.inProgress = true;
                        
                        // Salva qual previsão foi usada
                        this._lastPrediction = {
                            predicted: prediction.predicted,
                            confidence: confidence,
                            methods: [
                                'Statistical',
                                mlPrediction ? 'Scikit-Learn' : null,
                                nnPrediction ? 'NeuralNetwork' : null
                            ].filter(Boolean),
                            agreementRatio: agreementRatio
                        };
                    }
                } else {
                    logger.debug(`⏸ Aguardando melhor oportunidade... (${agreeCount}/${totalSources} concordam)`);
                }
            }

            // Check for cashout if we have an active bet
            if (this.betManager.isWaitingForResult && gameState.multiplier) {
                await this.betManager.checkCashout(frame);
            }

            this.previousMultiplier = gameState.multiplier;

            // Log status
            const stats = this.statsTracker.getStats();
            const accuracy = this.predictor.getAccuracyStats();
            logger.info(
                `Multiplier: ${gameState.multiplier || 0}x | ` +
                `Balance: ${gameState.formattedBalance} | ` +
                `Profit: ${stats.netProfit.toFixed(2)} | ` +
                `Win Rate: ${stats.winRate.toFixed(1)}% | ` +
                `Trades: ${stats.totalTrades} | ` +
                `Can Bet: ${gameState.betButton.exists && !this.gameState.betPlaced} | ` +
                `Acurácia: ${(accuracy.last10 * 100).toFixed(1)}% (${accuracy.trend})`
            );

        } catch (error) {
            logger.error(`Game monitoring error: ${error.message}`);
        }
    }

    startMonitoring() {
        logger.info('Starting game monitoring with aggressive strategy...');
        setInterval(() => this.monitorGame(), this.config.GAME.POLLING_INTERVAL);
    }
}

module.exports = GameMonitor;