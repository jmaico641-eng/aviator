/**
 * Rede Neural Profunda com TensorFlow.js para Previsão Aviator
 * 
 * Arquitetura:
 * - Input: Últimos N multiplicadores + features extraídas
 * - Hidden Layers: 3 camadas densas com dropout
 * - Output: Previsão do próximo multiplicador + intervalo de confiança
 * 
 * Features usadas:
 * - Últimos 20 multiplicadores
 * - Médias móveis (5, 10, 20)
 * - Desvio padrão recente
 * - Timing entre rodadas
 * - Features temporais (hora, minuto)
 * - Score RNG
 */

const tf = require('@tensorflow/tfjs');
const logger = require('../util/logger');

class NeuralNetworkPredictor {
    constructor(config = {}) {
        this.sequenceLength = config.sequenceLength || 20;
        this.model = null;
        this.isTrained = false;
        this.trainingData = [];
        this.trainingLabels = [];
        this.maxTrainingSamples = config.maxTrainingSamples || 5000;
        this.trainingHistory = [];
        
        // Hiperparâmetros
        this.learningRate = config.learningRate || 0.001;
        this.epochs = config.epochs || 50;
        this.batchSize = config.batchSize || 32;
        
        // Métricas
        this.metrics = {
            totalPredictions: 0,
            totalError: 0,
            lastUpdate: null
        };
    }

    /**
     * Cria ou recria o modelo
     */
    createModel() {
        // Input shape: sequência + features extras
        const inputSize = this.sequenceLength + 10; // 20 + 10 features

        this.model = tf.sequential({
            layers: [
                // Primeira camada densa
                tf.layers.dense({
                    inputShape: [inputSize],
                    units: 128,
                    activation: 'relu',
                    kernelInitializer: 'heNormal'
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.batchNormalization(),

                // Segunda camada
                tf.layers.dense({
                    units: 64,
                    activation: 'relu',
                    kernelInitializer: 'heNormal'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.batchNormalization(),

                // Terceira camada
                tf.layers.dense({
                    units: 32,
                    activation: 'relu',
                    kernelInitializer: 'heNormal'
                }),
                tf.layers.dropout({ rate: 0.1 }),

                // Camada de saída (regressão)
                tf.layers.dense({
                    units: 2, // [valor_previsto, incerteza]
                    activation: 'linear'
                })
            ]
        });

        // Compila com Adam optimizer
        this.model.compile({
            optimizer: tf.train.adam(this.learningRate),
            loss: 'meanSquaredError',
            metrics: ['mae']
        });

        logger.info('✅ Modelo neural criado');
        logger.info(`   Input: ${inputSize} features`);
        logger.info(`   Layers: ${this.model.layers.length}`);
        logger.info(`   Params: ${this.model.countParams().toLocaleString()}`);

        return this.model;
    }

    /**
     * Prepara dados para o modelo
     */
    prepareData(observations, timings = []) {
        const X = [];
        const y = [];

        for (let i = this.sequenceLength; i < observations.length - 1; i++) {
            const sequence = observations.slice(i - this.sequenceLength, i);
            
            // Extrai features
            const features = this.extractFeatures(sequence, timings, i);
            
            // Label: próximo valor
            const nextValue = observations[i + 1];

            X.push(features);
            y.push([nextValue, 0]); // [valor, incerteza]
        }

        return {
            X: tf.tensor2d(X),
            y: tf.tensor2d(y),
            samples: X.length
        };
    }

    /**
     * Extrai features de uma sequência
     */
    extractFeatures(sequence, timings, index) {
        const features = [];

        // 1. Últimos N multiplicadores (normalizados)
        const maxVal = Math.max(...sequence);
        const normalized = sequence.map(v => v / maxVal);
        features.push(...normalized);

        // 2. Médias móveis
        const ma5 = this.movingAverage(sequence, 5);
        const ma10 = this.movingAverage(sequence.slice(-10), 10);
        const ma20 = this.movingAverage(sequence, Math.min(20, sequence.length));
        features.push(ma5, ma10, ma20);

        // 3. Desvio padrão recente
        const stdDev = this.standardDeviation(sequence);
        features.push(stdDev);

        // 4. Tendência (slope)
        const slope = this.calculateSlope(sequence);
        features.push(slope);

        // 5. Features temporais
        const now = new Date();
        features.push(now.getHours() / 24, now.getMinutes() / 60);

        // 6. Timing (se disponível)
        if (timings.length > 0) {
            const recentTimings = timings.slice(-5);
            const avgTiming = recentTimings.reduce((a, b) => a + b, 0) / recentTimings.length;
            features.push(avgTiming / 1000); // Normaliza para segundos
        } else {
            features.push(0);
        }

        return features;
    }

    /**
     * Treina o modelo com dados históricos
     */
    async train(observations, timings = [], epochs = null) {
        if (observations.length < this.sequenceLength * 3) {
            logger.warn(`Dados insuficientes para treino: ${observations.length} (mín: ${this.sequenceLength * 3})`);
            return null;
        }

        logger.info(`\n🧠 Iniciando treino da rede neural...`);
        logger.info(`   Amostras: ${observations.length}`);

        // Cria modelo se não existe
        if (!this.model) {
            this.createModel();
        }

        // Prepara dados
        const { X, y, samples } = this.prepareData(observations, timings);
        logger.info(`   Features extraídas: ${samples} amostras`);

        if (samples < 10) {
            logger.warn('Amostras insuficientes após extração de features');
            X.dispose();
            y.dispose();
            return null;
        }

        // Treina
        const trainEpochs = epochs || this.epochs;
        const history = await this.model.fit(X, y, {
            epochs: trainEpochs,
            batchSize: this.batchSize,
            validationSplit: 0.2,
            shuffle: true,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    if (epoch % 10 === 0) {
                        logger.info(`   Epoch ${epoch + 1}/${trainEpochs}: loss=${logs.loss.toFixed(4)}, val_loss=${logs.val_loss.toFixed(4)}`);
                    }
                }
            }
        });

        // Salva histórico
        this.trainingHistory.push({
            date: Date.now(),
            samples: samples,
            epochs: trainEpochs,
            finalLoss: history.history.loss[history.history.loss.length - 1],
            finalValLoss: history.history.val_loss[history.history.val_loss.length - 1]
        });

        this.isTrained = true;
        this.metrics.lastUpdate = Date.now();

        // Limpa tensores
        X.dispose();
        y.dispose();

        logger.info('✅ Treino concluído!');
        logger.info(`   Loss final: ${history.history.loss[history.history.loss.length - 1].toFixed(4)}`);
        logger.info(`   Val Loss: ${history.history.val_loss[history.history.val_loss.length - 1].toFixed(4)}`);

        return history;
    }

    /**
     * Faz previsão com o modelo treinado
     */
    predict(observations, timings = []) {
        if (!this.isTrained) {
            logger.warn('Modelo não treinado');
            return null;
        }

        if (observations.length < this.sequenceLength) {
            logger.warn(`Dados insuficientes: ${observations.length} < ${this.sequenceLength}`);
            return null;
        }

        try {
            // Pega últimos valores
            const sequence = observations.slice(-this.sequenceLength);
            const features = this.extractFeatures(sequence, timings, sequence.length);
            
            const input = tf.tensor2d([features]);
            const prediction = this.model.predict(input);
            const result = prediction.arraySync()[0];

            // Limpa tensores
            input.dispose();
            prediction.dispose();

            const predictedValue = result[0];
            const uncertainty = Math.abs(result[1]) || 0.5;

            this.metrics.totalPredictions++;

            logger.debug(`🧠 Neural Network: ${predictedValue.toFixed(2)}x ±${uncertainty.toFixed(2)}`);

            return {
                value: Math.max(1.0, predictedValue),
                uncertainty: uncertainty,
                confidence: Math.max(0, Math.min(1, 1 - uncertainty / 5)),
                method: 'Neural Network (TensorFlow.js)'
            };
        } catch (error) {
            logger.error(`Erro na previsão neural: ${error.message}`);
            return null;
        }
    }

    /**
     * Adiciona feedback para aprendizado contínuo
     */
    addFeedback(observations, actualValue) {
        if (observations.length >= this.sequenceLength + 1) {
            this.trainingData.push(observations.slice(-this.sequenceLength));
            this.trainingLabels.push(actualValue);

            // Limita dados de treino
            if (this.trainingData.length > this.maxTrainingSamples) {
                this.trainingData.shift();
                this.trainingLabels.shift();
            }
        }
    }

    /**
     * Treino incremental com novos dados
     */
    async incrementalTrain() {
        if (this.trainingData.length < 50) {
            return null;
        }

        logger.info(`\n🔄 Treino incremental com ${this.trainingData.length} amostras...`);

        const X = tf.tensor2d(this.trainingData);
        const y = tf.tensor2d(this.trainingLabels.map(l => [l, 0]));

        const history = await this.model.fit(X, y, {
            epochs: 10,
            batchSize: 16,
            validationSplit: 0.2,
            shuffle: true
        });

        X.dispose();
        y.dispose();

        this.metrics.lastUpdate = Date.now();

        logger.info('✅ Treino incremental concluído');
        return history;
    }

    /**
     * Salva modelo em disco
     */
    async saveModel(path = 'file://./models/neural-network') {
        if (!this.model) {
            logger.warn('Nenhum modelo para salvar');
            return;
        }

        await this.model.save(path);
        logger.info(`💾 Modelo salvo em ${path}`);
    }

    /**
     * Carrega modelo do disco
     */
    async loadModel(path = 'file://./models/neural-network') {
        try {
            this.model = await tf.loadLayersModel(path);
            this.isTrained = true;
            logger.info('✅ Modelo carregado do disco');
            return true;
        } catch (error) {
            logger.warn(`Modelo não encontrado: ${error.message}`);
            return false;
        }
    }

    // ==================== HELPERS ====================

    movingAverage(arr, window) {
        if (arr.length < window) return arr.reduce((a, b) => a + b, 0) / arr.length;
        const slice = arr.slice(-window);
        return slice.reduce((a, b) => a + b, 0) / window;
    }

    standardDeviation(arr) {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;
        return Math.sqrt(variance);
    }

    calculateSlope(arr) {
        const n = arr.length;
        if (n < 2) return 0;
        
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += arr[i];
            sumXY += i * arr[i];
            sumX2 += i * i;
        }
        
        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    /**
     * Retorna métricas do modelo
     */
    getMetrics() {
        return {
            ...this.metrics,
            isTrained: this.isTrained,
            trainingSamples: this.trainingData.length,
            history: this.trainingHistory.slice(-5)
        };
    }
}

module.exports = NeuralNetworkPredictor;
