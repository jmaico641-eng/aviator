/**
 * Módulo de Previsão Estatística para Aviator
 * Usa múltiplos métodos estatísticos para prever o próximo multiplicador
 * 
 * Métodos implementados:
 * 1. Médias Móveis Ponderadas
 * 2. ARIMA (AutoRegressive Integrated Moving Average)
 * 3. Análise de Distribuição de Probabilidade
 * 4. Detecção de Tendências
 * 5. Pattern Matching
 */

const logger = require('../util/logger');

class AviatorPredictor {
    constructor(config = {}) {
        this.history = [];
        this.predictions = [];
        this.accuracy = {
            correct: 0,
            total: 0,
            predictions: []
        };
        this.maxHistory = config.maxHistory || 100;
        this.weights = config.weights || {
            movingAverage: 0.25,
            arima: 0.25,
            trend: 0.20,
            distribution: 0.20,
            pattern: 0.10
        };
    }

    /**
     * Adiciona novo observação ao histórico
     */
    addObservation(value) {
        this.history.push({
            value: parseFloat(value),
            timestamp: Date.now()
        });

        // Limita histórico
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        logger.debug(`Observação adicionada: ${value}x | Histórico: ${this.history.length}`);
    }

    /**
     * Faz previsão do próximo multiplicador
     */
    predict() {
        if (this.history.length < 10) {
            logger.warn('Histórico insuficiente para previsão precisa');
            return {
                predicted: null,
                confidence: 0,
                recommendation: 'AGUARDAR',
                reason: 'Coletando dados...',
                method: 'N/A'
            };
        }

        const values = this.history.map(h => h.value);

        // Executa todos os métodos de previsão
        const predictions = {
            movingAverage: this.predictMovingAverage(values),
            arima: this.predictARIMA(values),
            trend: this.predictTrend(values),
            distribution: this.predictDistribution(values),
            pattern: this.predictPattern(values)
        };

        // Combina previsões com pesos
        const combined = this.combinePredictions(predictions);

        // Determina recomendação
        const recommendation = this.generateRecommendation(combined, predictions);

        // Salva previsão para análise posterior
        this.predictions.push({
            ...combined,
            ...recommendation,
            individualPredictions: predictions,
            timestamp: Date.now()
        });

        logger.info(`Previsão: ${combined.predicted.toFixed(2)}x | Confiança: ${(combined.confidence * 100).toFixed(1)}%`);

        return {
            ...combined,
            ...recommendation
        };
    }

    /**
     * Método 1: Médias Móveis Ponderadas
     * Dá mais peso aos dados recentes
     */
    predictMovingAverage(values) {
        const n = values.length;
        
        // Média móvel simples (últimos 5)
        const shortMA = values.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, n);
        
        // Média móvel longa (últimos 10)
        const longMA = values.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, n);
        
        // Média ponderada exponencial (mais recente = mais peso)
        let expWeightedSum = 0;
        let expWeightTotal = 0;
        for (let i = 0; i < Math.min(10, n); i++) {
            const weight = Math.exp(i / 5); // Peso exponencial
            expWeightedSum += values[n - 1 - i] * weight;
            expWeightTotal += weight;
        }
        const expWeightedAvg = expWeightedSum / expWeightTotal;

        // Combina as médias
        const predicted = (shortMA * 0.3 + longMA * 0.3 + expWeightedAvg * 0.4);
        
        // Calcula desvio padrão para confiança
        const recentValues = values.slice(-10);
        const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
        const variance = recentValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / recentValues.length;
        const stdDev = Math.sqrt(variance);
        const confidence = Math.max(0, Math.min(1, 1 - (stdDev / mean)));

        return {
            value: predicted,
            confidence: confidence,
            method: 'Médias Móveis Ponderadas'
        };
    }

    /**
     * Método 2: ARIMA simplificado
     * AutoRegressive Integrated Moving Average
     */
    predictARIMA(values) {
        const n = values.length;
        const p = 3; // ordem AR
        const d = 1; // ordem de diferenciação
        const q = 2; // ordem MA

        // Diferenciação
        const diffValues = [];
        for (let i = 1; i < values.length; i++) {
            diffValues.push(values[i] - values[i - 1]);
        }

        // Componente AR (AutoRegressive)
        let arComponent = 0;
        for (let i = 0; i < Math.min(p, diffValues.length); i++) {
            const weight = 1 / (i + 1);
            arComponent += diffValues[diffValues.length - 1 - i] * weight;
        }

        // Componente MA (Moving Average)
        const recentErrors = diffValues.slice(-q);
        const maMean = recentErrors.length > 0 ? recentErrors.reduce((a, b) => a + b, 0) / recentErrors.length : 0;
        const maComponent = maMean * 0.5;

        // Prevê próxima diferença
        const nextDiff = arComponent + maComponent;
        
        // Reverte diferenciação
        const predicted = values[n - 1] + nextDiff;

        // Confiança baseada na estabilidade recente
        const recentDiff = diffValues.slice(-10);
        const meanDiff = Math.abs(recentDiff.reduce((a, b) => a + Math.abs(b), 0) / recentDiff.length);
        const confidence = Math.max(0, Math.min(1, 1 - (meanDiff / 10)));

        return {
            value: Math.max(1.0, predicted), // Mínimo 1.0
            confidence: confidence,
            method: 'ARIMA'
        };
    }

    /**
     * Método 3: Análise de Tendência
     * Detecta se os multiplicadores estão subindo ou descendo
     */
    predictTrend(values) {
        const n = values.length;
        const windowSize = Math.min(10, n);
        const recentValues = values.slice(-windowSize);

        // Calcula inclinação (slope) usando regressão linear simples
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < recentValues.length; i++) {
            sumX += i;
            sumY += recentValues[i];
            sumXY += i * recentValues[i];
            sumX2 += i * i;
        }

        const slope = (windowSize * sumXY - sumX * sumY) / (windowSize * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / windowSize;

        // Prevê próximo valor
        const predicted = intercept + slope * windowSize;

        // Confiança baseada na força da tendência
        const mean = sumY / windowSize;
        const rSquared = this.calculateRSquared(recentValues, (i) => intercept + slope * i);
        const confidence = Math.max(0, Math.min(1, rSquared));

        return {
            value: Math.max(1.0, predicted),
            confidence: confidence,
            method: 'Análise de Tendência',
            slope: slope,
            direction: slope > 0 ? 'SUBINDO' : slope < 0 ? 'DESCENDO' : 'ESTÁVEL'
        };
    }

    /**
     * Método 4: Análise de Distribuição de Probabilidade
     * Baseado na distribuição histórica dos valores
     */
    predictDistribution(values) {
        const n = values.length;
        
        // Calcula estatísticas
        const mean = values.reduce((a, b) => a + b, 0) / n;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);
        
        // Moda (valor mais frequente)
        const rounded = values.map(v => Math.round(v * 10) / 10);
        const frequency = {};
        rounded.forEach(v => {
            frequency[v] = (frequency[v] || 0) + 1;
        });
        const mode = Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
        
        // Mediana
        const sorted = [...values].sort((a, b) => a - b);
        const median = sorted[Math.floor(n / 2)];

        // Percentil 25 (mais conservador)
        const p25 = sorted[Math.floor(n * 0.25)];
        
        // Usa mediana como previsão principal (mais robusta que média)
        const predicted = median;
        
        // Confiança baseada na concentração dos dados
        const cv = stdDev / mean; // Coeficiente de variação
        const confidence = Math.max(0, Math.min(1, 1 - cv));

        return {
            value: predicted,
            confidence: confidence,
            method: 'Distribuição de Probabilidade',
            stats: { mean, median, mode: parseFloat(mode), stdDev, p25 }
        };
    }

    /**
     * Método 5: Pattern Matching
     * Identifica padrões recorrentes no histórico
     */
    predictPattern(values) {
        const n = values.length;
        const patternLength = Math.min(3, n - 1);
        const currentPattern = values.slice(-patternLength);

        // Busca padrões similares no histórico
        let similarPatterns = [];
        
        for (let i = 0; i < n - patternLength - 1; i++) {
            const historicalPattern = values.slice(i, i + patternLength);
            const similarity = this.calculateSimilarity(currentPattern, historicalPattern);
            
            if (similarity > 0.7) { // 70% similar
                similarPatterns.push({
                    value: values[i + patternLength],
                    similarity: similarity
                });
            }
        }

        // Se encontrou padrões similares
        if (similarPatterns.length > 0) {
            // Ordena por similaridade e pega top 5
            similarPatterns.sort((a, b) => b.similarity - a.similarity);
            const topPatterns = similarPatterns.slice(0, 5);
            
            const predicted = topPatterns.reduce((acc, p) => acc + p.value, 0) / topPatterns.length;
            const avgSimilarity = topPatterns.reduce((acc, p) => acc + p.similarity, 0) / topPatterns.length;

            return {
                value: predicted,
                confidence: avgSimilarity,
                method: 'Pattern Matching',
                patternsFound: similarPatterns.length
            };
        }

        // Sem padrões encontrados, usa média recente
        const recentMean = values.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, n);
        return {
            value: recentMean,
            confidence: 0.3,
            method: 'Pattern Matching (fallback)',
            patternsFound: 0
        };
    }

    /**
     * Combina todas as previsões com pesos
     */
    combinePredictions(predictions) {
        let weightedSum = 0;
        let weightTotal = 0;
        let confidenceSum = 0;

        for (const [method, pred] of Object.entries(predictions)) {
            const weight = this.weights[method] || 0.1;
            weightedSum += pred.value * weight;
            weightTotal += weight;
            confidenceSum += pred.confidence * weight;
        }

        const predicted = weightedSum / weightTotal;
        const confidence = confidenceSum / weightTotal;

        return {
            predicted: Math.max(1.0, predicted),
            confidence: confidence,
            methods: Object.keys(predictions)
        };
    }

    /**
     * Gera recomendação baseada na previsão
     */
    generateRecommendation(combined, individualPredictions) {
        const { predicted, confidence } = combined;
        
        // Análise de consenso
        const predictions = Object.values(individualPredictions).map(p => p.value);
        const min = Math.min(...predictions);
        const max = Math.max(...predictions);
        const range = max - min;
        const consensus = 1 - (range / (max + min) * 2);

        // Recomendação baseada em múltiplos fatores
        let recommendation, reason;

        if (confidence < 0.3) {
            recommendation = 'AGUARDAR';
            reason = 'Confiança muito baixa para previsão';
        } else if (consensus < 0.5) {
            recommendation = 'AGUARDAR';
            reason = 'Métodos discordam significativamente';
        } else if (predicted >= 2.0 && confidence >= 0.6) {
            recommendation = 'APOSTAR_CONSERVADOR';
            reason = `Previsão ${predicted.toFixed(2)}x com ${confidence.toFixed(0)}% de confiança`;
        } else if (predicted >= 1.5 && confidence >= 0.7) {
            recommendation = 'APOSTAR_MODERADO';
            reason = `Previsão ${predicted.toFixed(2)}x - boa oportunidade`;
        } else if (predicted < 1.5) {
            recommendation = 'NÃO_APOSTAR';
            reason = 'Previsão abaixo de 1.5x - risco alto';
        } else {
            recommendation = 'AGUARDAR';
            reason = 'Condições não ideais para aposta';
        }

        return {
            recommendation,
            reason,
            consensus: consensus
        };
    }

    /**
     * Avalia acurácia da última previsão
     */
    evaluatePrediction(actualValue) {
        if (this.predictions.length === 0) return;

        const lastPrediction = this.predictions[this.predictions.length - 1];
        const predicted = lastPrediction.predicted;
        const error = Math.abs(predicted - actualValue) / actualValue;
        const accuracy = Math.max(0, 1 - error);

        this.accuracy.correct += accuracy;
        this.accuracy.total += 1;
        this.accuracy.predictions.push({
            predicted,
            actual: actualValue,
            accuracy: accuracy,
            timestamp: Date.now()
        });

        // Mantém apenas últimas 100 avaliações
        if (this.accuracy.predictions.length > 100) {
            this.accuracy.predictions.shift();
        }

        logger.info(`Avaliação: Previsto=${predicted.toFixed(2)}x | Real=${actualValue}x | Acurácia=${(accuracy * 100).toFixed(1)}%`);

        return accuracy;
    }

    /**
     * Retorna estatísticas de acurácia
     */
    getAccuracyStats() {
        if (this.accuracy.total === 0) {
            return {
                averageAccuracy: 0,
                totalPredictions: 0,
                last10: 0,
                trend: 'N/A'
            };
        }

        const avgAccuracy = this.accuracy.correct / this.accuracy.total;
        const last10 = this.accuracy.predictions.slice(-10);
        const last10Avg = last10.length > 0 
            ? last10.reduce((acc, p) => acc + p.accuracy, 0) / last10.length 
            : 0;

        // Tendência: comparando primeira metade com segunda metade
        const half = Math.floor(this.accuracy.predictions.length / 2);
        const firstHalf = this.accuracy.predictions.slice(0, half);
        const secondHalf = this.accuracy.predictions.slice(half);
        
        let trend = 'N/A';
        if (firstHalf.length > 0 && secondHalf.length > 0) {
            const firstAvg = firstHalf.reduce((acc, p) => acc + p.accuracy, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((acc, p) => acc + p.accuracy, 0) / secondHalf.length;
            trend = secondAvg > firstAvg ? 'MELHORANDO' : secondAvg < firstAvg ? 'PIORANDO' : 'ESTÁVEL';
        }

        return {
            averageAccuracy: avgAccuracy,
            totalPredictions: this.accuracy.total,
            last10: last10Avg,
            trend
        };
    }

    /**
     * Calcula similaridade entre dois padrões (cosseno)
     */
    calculateSimilarity(a, b) {
        if (a.length !== b.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        if (normA === 0 || normB === 0) return 0;
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Calcula R² (coeficiente de determinação)
     */
    calculateRSquared(actual, predict) {
        const n = actual.length;
        const mean = actual.reduce((a, b) => a + b, 0) / n;
        
        let ssRes = 0; // Soma dos quadrados dos resíduos
        let ssTot = 0; // Soma total dos quadrados
        
        for (let i = 0; i < n; i++) {
            const predicted = predict(i);
            ssRes += Math.pow(actual[i] - predicted, 2);
            ssTot += Math.pow(actual[i] - mean, 2);
        }
        
        return 1 - (ssRes / ssTot);
    }

    /**
     * Retorna resumo completo
     */
    getSummary() {
        const values = this.history.map(h => h.value);
        const accuracy = this.getAccuracyStats();

        return {
            historySize: values.length,
            currentStreak: values.slice(-5),
            prediction: this.predict(),
            accuracy: accuracy,
            statistics: {
                mean: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
                max: values.length > 0 ? Math.max(...values) : 0,
                min: values.length > 0 ? Math.min(...values) : 0,
                lastValue: values.length > 0 ? values[values.length - 1] : 0
            }
        };
    }
}

module.exports = AviatorPredictor;
