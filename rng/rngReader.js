/**
 * RNG Reader Avançado para Aviator
 * 
 * Este módulo analisa o gerador de números aleatórios (RNG) do jogo Aviator
 * usando múltiplas técnicas estatísticas avançadas para detectar padrões,
 * vieses e anomalias que podem indicar não-aleatoriedade.
 * 
 * Técnicas implementadas:
 * 1. Análise de Entropia (Shannon, Min-Entropy)
 * 2. Teste Chi-Quadrado de distribuição
 * 3. Análise de Timing entre resultados
 * 4. Detecção de Bias/Viés estatístico
 * 5. Análise de Sequências (Runs Test)
 * 6. Teste de Kolmogorov-Smirnov
 * 7. Análise Espectral (FFT simplificado)
 * 8. Detecção de padrões de seed
 * 9. Análise de autocorrelação
 * 10. Markov Chain Analysis
 */

const logger = require('../util/logger');

class RNGReader {
    constructor(config = {}) {
        this.data = [];
        this.timestamps = [];
        this.minSamples = config.minSamples || 50;
        this.bins = config.bins || 10;
        this.maxHistory = config.maxHistory || 1000;
        
        // Cache de análises
        this.analysisCache = {
            lastUpdate: 0,
            entropy: null,
            distribution: null,
            bias: null,
            timing: null
        };
        
        // Período de cache (5 segundos)
        this.cacheTimeout = 5000;
    }

    /**
     * Adiciona nova observação ao dataset
     */
    addObservation(value, timestamp = null) {
        const observation = {
            value: parseFloat(value),
            timestamp: timestamp || Date.now(),
            sequenceNumber: this.data.length + 1
        };

        this.data.push(observation.value);
        this.timestamps.push(observation.timestamp);

        // Limita histórico
        if (this.data.length > this.maxHistory) {
            this.data.shift();
            this.timestamps.shift();
        }

        // Invalida cache
        this.analysisCache.lastUpdate = 0;

        logger.debug(`RNG Observation: ${observation.value.toFixed(2)}x | Total: ${this.data.length}`);
        
        return observation;
    }

    /**
     * Análise completa do RNG
     */
    analyze() {
        if (this.data.length < this.minSamples) {
            return {
                status: 'INSUFFICIENT_DATA',
                samples: this.data.length,
                required: this.minSamples,
                message: `Coletando mais dados... (${this.data.length}/${this.minSamples})`
            };
        }

        return {
            status: 'OK',
            samples: this.data.length,
            timestamp: Date.now(),
            
            // Todas as análises
            entropy: this.analyzeEntropy(),
            distribution: this.analyzeDistribution(),
            bias: this.analyzeBias(),
            timing: this.analyzeTiming(),
            sequences: this.analyzeSequences(),
            kolmogorovSmirnov: this.testKolmogorovSmirnov(),
            spectral: this.analyzeSpectral(),
            seedAnalysis: this.analyzeSeedPatterns(),
            autocorrelation: this.analyzeAutocorrelation(),
            markov: this.analyzeMarkovChains(),
            
            // Score geral de aleatoriedade
            randomnessScore: this.calculateRandomnessScore()
        };
    }

    /**
     * 1. ANÁLISE DE ENTROPIA
     * Mede quão "imprevisível" é a distribuição
     */
    analyzeEntropy() {
        // Verifica cache
        if (this.analysisCache.entropy && 
            (Date.now() - this.analysisCache.lastUpdate) < this.cacheTimeout) {
            return this.analysisCache.entropy;
        }

        const values = this.data;
        const n = values.length;

        // Discretiza valores em bins
        const binCounts = new Array(this.bins).fill(0);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const binWidth = (maxVal - minVal) / this.bins;

        values.forEach(v => {
            const binIndex = Math.min(Math.floor((v - minVal) / binWidth), this.bins - 1);
            binCounts[binIndex]++;
        });

        // Shannon Entropy
        let shannonEntropy = 0;
        for (const count of binCounts) {
            if (count > 0) {
                const p = count / n;
                shannonEntropy -= p * Math.log2(p);
            }
        }

        // Entropia máxima possível
        const maxEntropy = Math.log2(this.bins);
        const normalizedEntropy = shannonEntropy / maxEntropy;

        // Min-Entropy (pior caso)
        const maxProb = Math.max(...binCounts) / n;
        const minEntropy = -Math.log2(maxProb);
        const maxMinEntropy = Math.log2(this.bins);
        const normalizedMinEntropy = minEntropy / maxMinEntropy;

        const result = {
            shannon: shannonEntropy,
            shannonNormalized: normalizedEntropy,
            minEntropy: minEntropy,
            minEntropyNormalized: normalizedMinEntropy,
            maxPossible: maxEntropy,
            quality: normalizedEntropy > 0.9 ? 'HIGH' : normalizedEntropy > 0.7 ? 'MEDIUM' : 'LOW',
            interpretation: this.interpretEntropy(normalizedEntropy)
        };

        this.analysisCache.entropy = result;
        return result;
    }

    /**
     * 2. TESTE CHI-QUADRADO
     * Verifica se a distribuição é uniforme
     */
    analyzeDistribution() {
        const values = this.data;
        const n = values.length;
        const bins = this.bins;
        
        // Cria histograma
        const binCounts = new Array(bins).fill(0);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const binWidth = (maxVal - minVal) / bins;

        values.forEach(v => {
            const binIndex = Math.min(Math.floor((v - minVal) / binWidth), bins - 1);
            binCounts[binIndex]++;
        });

        // Chi-quadrado
        const expected = n / bins;
        let chiSquare = 0;
        for (const count of binCounts) {
            chiSquare += Math.pow(count - expected, 2) / expected;
        }

        // Graus de liberdade
        const df = bins - 1;
        
        // Valor crítico para α=0.05
        const criticalValue = this.getChiSquareCritical(df, 0.05);
        const isUniform = chiSquare < criticalValue;

        // P-value aproximado
        const pValue = this.approximatePValue(chiSquare, df);

        return {
            chiSquare: chiSquare,
            degreesOfFreedom: df,
            criticalValue: criticalValue,
            pValue: pValue,
            isUniform: isUniform,
            significance: 0.05,
            interpretation: isUniform 
                ? 'Distribuição uniforme (parece aleatório)' 
                : 'Distribuição NÃO uniforme (possível padrão detectado)',
            binCounts: binCounts,
            expected: expected
        };
    }

    /**
     * 3. ANÁLISE DE BIAS/VIÉS
     * Detecta se há tendência em alguma direção
     */
    analyzeBias() {
        const values = this.data;
        const n = values.length;

        // Estatísticas básicas
        const mean = values.reduce((a, b) => a + b, 0) / n;
        const median = this.calculateMedian(values);
        const mode = this.calculateMode(values);

        // Skewness (assimetria)
        const stdDev = this.calculateStdDev(values);
        let skewness = 0;
        if (stdDev > 0) {
            for (const v of values) {
                skewness += Math.pow((v - mean) / stdDev, 3);
            }
            skewness = (skewness * n) / ((n - 1) * (n - 2));
        }

        // Kurtosis (curtose)
        let kurtosis = 0;
        if (stdDev > 0) {
            for (const v of values) {
                kurtosis += Math.pow((v - mean) / stdDev, 4);
            }
            kurtosis = (kurtosis * n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) - 
                       (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
        }

        // Testa se mean ≈ median ≈ mode (indicativo de simetria)
        const symmetryScore = 1 - Math.min(1, Math.abs(mean - median) / (mean + 0.001));

        // Detecta bias
        const hasBias = Math.abs(skewness) > 0.5 || Math.abs(kurtosis) > 1;

        return {
            mean: mean,
            median: median,
            mode: mode,
            stdDev: stdDev,
            skewness: skewness,
            kurtosis: kurtosis,
            symmetryScore: symmetryScore,
            hasBias: hasBias,
            biasDirection: skewness > 0 ? 'RIGHT' : skewness < 0 ? 'LEFT' : 'NONE',
            interpretation: hasBias 
                ? `Bias detectado: ${skewness > 0 ? 'tendência valores altos' : 'tendência valores baixos'}`
                : 'Sem bias significativo detectado'
        };
    }

    /**
     * 4. ANÁLISE DE TIMING
     * Analisa intervalos entre resultados para detectar padrões temporais
     */
    analyzeTiming() {
        if (this.timestamps.length < 10) {
            return {
                status: 'INSUFFICIENT_DATA',
                message: 'Precisa de mais timestamps'
            };
        }

        // Calcula intervalos
        const intervals = [];
        for (let i = 1; i < this.timestamps.length; i++) {
            intervals.push(this.timestamps[i] - this.timestamps[i - 1]);
        }

        const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const stdDevInterval = this.calculateStdDev(intervals);
        const cvInterval = stdDevInterval / meanInterval; // Coeficiente de variação

        // Detecta periodicidade (autocorrelação dos intervalos)
        const autocorrelation = this.calculateAutocorrelation(intervals, 1);

        // Detecta padrões (intervalos muito regulares)
        const isRegular = cvInterval < 0.1;

        // Análise de jitter
        const jitter = intervals.map((interval, i) => {
            if (i === 0) return 0;
            return Math.abs(interval - intervals[i - 1]);
        }).slice(1);
        
        const meanJitter = jitter.reduce((a, b) => a + b, 0) / jitter.length;

        return {
            meanInterval: meanInterval,
            stdDevInterval: stdDevInterval,
            cvInterval: cvInterval,
            autocorrelation: autocorrelation,
            isRegular: isRegular,
            meanJitter: meanJitter,
            regularity: 1 - cvInterval,
            interpretation: isRegular
                ? 'Intervalos muito regulares (possível RNG determinístico)'
                : 'Intervalos variáveis (esperado em RNG bom)',
            samples: intervals.length
        };
    }

    /**
     * 5. ANÁLISE DE SEQUÊNCIAS (Runs Test)
     * Testa se as sequências de altos/baixos são aleatórias
     */
    analyzeSequences() {
        const values = this.data;
        const median = this.calculateMedian(values);

        // Converte para sequência binária (acima/abaixo da mediana)
        const binary = values.map(v => v > median ? 1 : 0);

        // Conta runs (sequências consecutivas do mesmo valor)
        let runs = 1;
        for (let i = 1; i < binary.length; i++) {
            if (binary[i] !== binary[i - 1]) {
                runs++;
            }
        }

        // Estatísticas esperadas
        const n1 = binary.filter(b => b === 1).length;
        const n0 = binary.length - n1;
        const n = binary.length;

        const expectedRuns = 1 + (2 * n1 * n0) / n;
        const varianceRuns = (2 * n1 * n0 * (2 * n1 * n0 - n)) / (n * n * (n - 1));
        const stdDevRuns = Math.sqrt(varianceRuns);

        // Z-score
        const zScore = (runs - expectedRuns) / stdDevRuns;
        const isRandom = Math.abs(zScore) < 1.96; // 95% confiança

        return {
            totalRuns: runs,
            expectedRuns: expectedRuns,
            zScore: zScore,
            isRandom: isRandom,
            n1: n1,
            n0: n0,
            interpretation: isRandom
                ? 'Sequências parecem aleatórias'
                : `Sequências NÃO aleatórias (z=${zScore.toFixed(2)})`
        };
    }

    /**
     * 6. TESTE DE KOLMOGOROV-SMIRNOV
     * Compara distribuição empírica com distribuição esperada
     */
    testKolmogorovSmirnov() {
        const values = [...this.data].sort((a, b) => a - b);
        const n = values.length;
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);

        // Calcula D estatística
        let dStat = 0;
        for (let i = 0; i < n; i++) {
            const empiricalCDF = (i + 1) / n;
            const theoreticalCDF = (values[i] - minVal) / (maxVal - minVal);
            dStat = Math.max(dStat, Math.abs(empiricalCDF - theoreticalCDF));
        }

        // Valor crítico para α=0.05
        const criticalValue = 1.36 / Math.sqrt(n);
        const isFromDistribution = dStat < criticalValue;

        return {
            dStatistic: dStat,
            criticalValue: criticalValue,
            isFromDistribution: isFromDistribution,
            significance: 0.05,
            interpretation: isFromDistribution
                ? 'Dados seguem distribuição esperada'
                : 'Dados NÃO seguem distribuição esperada (padrão detectado!)'
        };
    }

    /**
     * 7. ANÁLISE ESPECTRAL (FFT simplificado)
     * Detecta periodicidades escondidas
     */
    analyzeSpectral() {
        const values = this.data;
        const n = values.length;
        
        // Remove média
        const centered = values.map(v => v - values.reduce((a, b) => a + b, 0) / n);

        // FFT simplificado (apenas magnitudes)
        const magnitudes = [];
        const maxFreq = Math.floor(n / 2);
        
        for (let k = 1; k <= Math.min(maxFreq, 50); k++) {
            let real = 0;
            let imag = 0;
            
            for (let t = 0; t < n; t++) {
                const angle = (2 * Math.PI * k * t) / n;
                real += centered[t] * Math.cos(angle);
                imag -= centered[t] * Math.sin(angle);
            }
            
            const magnitude = Math.sqrt(real * real + imag * imag);
            magnitudes.push({ frequency: k, magnitude: magnitude });
        }

        // Encontra picos dominantes
        magnitudes.sort((a, b) => b.magnitude - a.magnitude);
        const dominantFrequencies = magnitudes.slice(0, 5);

        // Calcula entropia espectral
        const totalMagnitude = magnitudes.reduce((acc, m) => acc + m.magnitude, 0);
        let spectralEntropy = 0;
        
        for (const m of magnitudes) {
            if (m.magnitude > 0) {
                const p = m.magnitude / totalMagnitude;
                spectralEntropy -= p * Math.log2(p);
            }
        }

        const maxSpectralEntropy = Math.log2(magnitudes.length);
        const normalizedSpectralEntropy = spectralEntropy / maxSpectralEntropy;

        return {
            dominantFrequencies: dominantFrequencies,
            spectralEntropy: spectralEntropy,
            normalizedSpectralEntropy: normalizedSpectralEntropy,
            hasDominantFrequency: dominantFrequencies[0].magnitude > totalMagnitude * 0.3,
            interpretation: normalizedSpectralEntropy > 0.8
                ? 'Espectro plano (aleatório)'
                : 'Picos dominantes detectados (possível periodicidade)'
        };
    }

    /**
     * 8. ANÁLISE DE PADRÕES DE SEED
     * Tenta identificar se há reutilização de seeds
     */
    analyzeSeedPatterns() {
        const values = this.data;
        const n = values.length;

        // Procura por subsequências idênticas
        const subsequenceLength = 3;
        const subsequences = {};
        let repetitions = 0;

        for (let i = 0; i <= n - subsequenceLength; i++) {
            const subseq = values.slice(i, i + subsequenceLength)
                .map(v => Math.round(v * 100)).join(',');
            
            if (subsequences[subseq]) {
                subsequences[subseq]++;
                repetitions++;
            } else {
                subsequences[subseq] = 1;
            }
        }

        const totalSubsequences = n - subsequenceLength + 1;
        const repetitionRate = repetitions / totalSubsequences;

        // Valores mais frequentes
        const frequencyMap = {};
        values.forEach(v => {
            const rounded = Math.round(v * 10) / 10;
            frequencyMap[rounded] = (frequencyMap[rounded] || 0) + 1;
        });

        const sortedFreqs = Object.entries(frequencyMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([val, count]) => ({ value: parseFloat(val), count, frequency: count / n }));

        return {
            repetitionRate: repetitionRate,
            uniqueSubsequences: Object.keys(subsequences).length,
            totalSubsequences: totalSubsequences,
            mostFrequentValues: sortedFreqs,
            hasSeedPattern: repetitionRate > 0.1,
            interpretation: repetitionRate > 0.1
                ? `Alta taxa de repetição (${(repetitionRate * 100).toFixed(1)}%) - possível seed fraca`
                : 'Baixa repetição de padrões (seed parece forte)'
        };
    }

    /**
     * 9. ANÁLISE DE AUTOCORRELAÇÃO
     * Verifica se valores passados correlacionam com futuros
     */
    analyzeAutocorrelation() {
        const values = this.data;
        const n = values.length;
        const maxLag = Math.min(20, Math.floor(n / 2));

        const autocorrelations = [];
        
        for (let lag = 1; lag <= maxLag; lag++) {
            const ac = this.calculateAutocorrelation(values, lag);
            autocorrelations.push({ lag, value: ac });
        }

        // Encontra autocorrelações significativas
        const significantLags = autocorrelations.filter(
            ac => Math.abs(ac.value) > 2 / Math.sqrt(n)
        );

        const hasAutocorrelation = significantLags.length > 0;

        return {
            autocorrelations: autocorrelations.slice(0, 10), // Primeiros 10
            significantLags: significantLags,
            hasAutocorrelation: hasAutocorrelation,
            maxAutocorrelation: Math.max(...autocorrelations.map(ac => Math.abs(ac.value))),
            interpretation: hasAutocorrelation
                ? `Autocorrelação detectada em ${significantLags.length} lag(s) - valores não são independentes`
                : 'Sem autocorrelação significativa (valores independentes)'
        };
    }

    /**
     * 10. ANÁLISE DE CADEIAS DE MARKOV
     * Modela transições entre estados
     */
    analyzeMarkovChains() {
        const values = this.data;
        
        // Discretiza em estados (baixo, médio, alto)
        const percentiles = this.calculatePercentiles(values, [33, 66]);
        const states = values.map(v => 
            v < percentiles[0] ? 'LOW' : v < percentiles[1] ? 'MEDIUM' : 'HIGH'
        );

        // Matriz de transição
        const transitions = {
            LOW: { LOW: 0, MEDIUM: 0, HIGH: 0 },
            MEDIUM: { LOW: 0, MEDIUM: 0, HIGH: 0 },
            HIGH: { LOW: 0, MEDIUM: 0, HIGH: 0 }
        };

        for (let i = 0; i < states.length - 1; i++) {
            const current = states[i];
            const next = states[i + 1];
            transitions[current][next]++;
        }

        // Normaliza para probabilidades
        const transitionMatrix = {};
        for (const state of ['LOW', 'MEDIUM', 'HIGH']) {
            const total = Object.values(transitions[state]).reduce((a, b) => a + b, 0);
            transitionMatrix[state] = {};
            for (const next of ['LOW', 'MEDIUM', 'HIGH']) {
                transitionMatrix[state][next] = transitions[state][next] / total;
            }
        }

        // Calcula entropia da matriz de transição
        let transitionEntropy = 0;
        for (const state of ['LOW', 'MEDIUM', 'HIGH']) {
            for (const next of ['LOW', 'MEDIUM', 'HIGH']) {
                const p = transitionMatrix[state][next];
                if (p > 0) {
                    transitionEntropy -= p * Math.log2(p);
                }
            }
        }
        transitionEntropy /= 3; // Normaliza

        const maxTransitionEntropy = Math.log2(3);
        const normalizedEntropy = transitionEntropy / maxTransitionEntropy;

        // Detecta padrões fortes
        const maxTransition = Math.max(
            ...Object.values(transitionMatrix).flatMap(Object.values)
        );
        const hasStrongPattern = maxTransition > 0.7;

        return {
            transitionMatrix: transitionMatrix,
            transitionEntropy: transitionEntropy,
            normalizedEntropy: normalizedEntropy,
            hasStrongPattern: hasStrongPattern,
            interpretation: hasStrongPattern
                ? `Padrão forte detectado: transição de ${(maxTransition * 100).toFixed(0)}%`
                : 'Transições bem distribuídas (parece aleatório)'
        };
    }

    /**
     * Calcula score geral de aleatoriedade (0-100)
     */
    calculateRandomnessScore() {
        if (this.data.length < this.minSamples) return 0;

        const entropy = this.analyzeEntropy();
        const distribution = this.analyzeDistribution();
        const sequences = this.analyzeSequences();
        const markov = this.analyzeMarkovChains();
        const autocorr = this.analyzeAutocorrelation();

        // Ponderação dos testes
        let score = 100;

        // Entropia (peso 25)
        score -= (1 - entropy.shannonNormalized) * 25;

        // Distribuição uniforme (peso 20)
        if (!distribution.isUniform) score -= 20;

        // Sequências aleatórias (peso 20)
        if (!sequences.isRandom) score -= 15;

        // Markov (peso 20)
        score -= (1 - markov.normalizedEntropy) * 20;

        // Autocorrelação (peso 15)
        if (autocorr.hasAutocorrelation) score -= 15;

        score = Math.max(0, Math.min(100, Math.round(score)));

        let quality;
        if (score >= 80) quality = 'HIGH_RANDOMNESS';
        else if (score >= 60) quality = 'MEDIUM_RANDOMNESS';
        else if (score >= 40) quality = 'LOW_RANDOMNESS';
        else quality = 'PATTERN_DETECTED';

        return {
            score: score,
            quality: quality,
            interpretation: this.interpretRandomnessScore(score)
        };
    }

    // ==================== MÉTODOS AUXILIARES ====================

    calculateMedian(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 
            ? sorted[mid] 
            : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    calculateMode(arr) {
        const frequency = {};
        arr.forEach(v => {
            const rounded = Math.round(v * 10) / 10;
            frequency[rounded] = (frequency[rounded] || 0) + 1;
        });
        return parseFloat(Object.entries(frequency).reduce((a, b) => 
            frequency[a[0]] > frequency[b[0]] ? a : b
        )[0]);
    }

    calculateStdDev(arr) {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;
        return Math.sqrt(variance);
    }

    calculatePercentiles(arr, percentiles) {
        const sorted = [...arr].sort((a, b) => a - b);
        return percentiles.map(p => {
            const index = Math.floor((p / 100) * sorted.length);
            return sorted[index];
        });
    }

    calculateAutocorrelation(values, lag) {
        const n = values.length;
        const mean = values.reduce((a, b) => a + b, 0) / n;
        
        let covariance = 0;
        let variance = 0;
        
        for (let i = 0; i < n - lag; i++) {
            covariance += (values[i] - mean) * (values[i + lag] - mean);
        }
        
        for (let i = 0; i < n; i++) {
            variance += Math.pow(values[i] - mean, 2);
        }
        
        return covariance / variance;
    }

    interpretEntropy(normalized) {
        if (normalized > 0.95) return 'Entropia muito alta - altamente imprevisível';
        if (normalized > 0.85) return 'Entropia alta - boa aleatoriedade';
        if (normalized > 0.70) return 'Entropia média - alguma previsibilidade';
        return 'Entropia baixa - possível padrão detectado';
    }

    interpretRandomnessScore(score) {
        if (score >= 90) return 'Excelente aleatoriedade - difícil prever';
        if (score >= 75) return 'Boa aleatoriedade - alguns padrões menores';
        if (score >= 60) return 'Aleatoriedade moderada - padrões detectáveis';
        if (score >= 40) return 'Baixa aleatoriedade - previsibilidade possível';
        return 'Padrões fortes detectados - previsível';
    }

    getChiSquareCritical(df, alpha) {
        // Tabela simplificada de valores críticos
        const criticalValues = {
            9: 16.919,
            10: 18.307,
            15: 24.996,
            20: 31.410,
            25: 37.652,
            30: 43.773
        };
        
        return criticalValues[df] || df * 1.5; // Aproximação
    }

    approximatePValue(chiSquare, df) {
        // Aproximação simples
        const expected = df;
        const stdDev = Math.sqrt(2 * df);
        const zScore = (chiSquare - expected) / stdDev;
        
        // Aproximação da função de distribuição normal
        return 0.5 * (1 + this.erf(zScore / Math.sqrt(2)));
    }

    erf(x) {
        // Aproximação da função de erro
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;

        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x);

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return sign * y;
    }
}

module.exports = RNGReader;
