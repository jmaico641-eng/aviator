/**
 * Timing Attack Analyzer para Aviator
 * 
 * Analisa padrões temporais ultra-precisos no RNG:
 * - Microssegundos entre rodadas
 * - Jitter e variações
 * - Periodicidade escondida
 * - Correlação tempo-resultado
 * - Padrões baseados em horário
 * 
 * Alguns RNGs fracos têm vazamento de informação
 * através do timing, especialmente se usam:
 * - time() como seed
 * - LCG com estado temporal
 * - Padrões de alocação de memória
 */

const logger = require('../util/logger');

class TimingAttackAnalyzer {
    constructor(config = {}) {
        this.timings = [];
        this.results = [];
        this.maxHistory = config.maxHistory || 5000;
        this.minSamples = config.minSamples || 100;
        
        // Cache de análise
        this.analysisCache = {
            lastUpdate: 0,
            patterns: null
        };
        this.cacheTimeout = 10000; // 10 segundos
    }

    /**
     * Registra timing preciso de uma rodada
     */
    recordRound(roundData) {
        const record = {
            roundId: roundData.roundId || this.timings.length + 1,
            startTime: this.getHighPrecisionTimestamp(),
            endTime: roundData.endTime || this.getHighPrecisionTimestamp(),
            multiplier: roundData.multiplier,
            duration: roundData.duration || 0,
            processHrTime: process.hrtime.bigint() // Nanosegundos
        };

        record.duration = Number(record.endTime - record.startTime);

        this.timings.push(record);
        this.results.push({
            multiplier: record.multiplier,
            timestamp: record.startTime,
            duration: record.duration
        });

        // Limita histórico
        if (this.timings.length > this.maxHistory) {
            this.timings.shift();
            this.results.shift();
        }

        // Invalida cache
        this.analysisCache.lastUpdate = 0;

        return record;
    }

    /**
     * Timestamp de alta precisão (microssegundos)
     */
    getHighPrecisionTimestamp() {
        return Date.now() * 1000 + process.hrtime()[1] / 1000; // Microssegundos
    }

    /**
     * Análise completa de timing
     */
    analyze() {
        if (this.timings.length < this.minSamples) {
            return {
                status: 'COLLECTING',
                samples: this.timings.length,
                required: this.minSamples,
                message: `Coletando dados de timing... (${this.timings.length}/${this.minSamples})`
            };
        }

        return {
            status: 'OK',
            samples: this.timings.length,
            
            // Todas as análises
            intervals: this.analyzeIntervals(),
            periodicity: this.detectPeriodicity(),
            jitter: this.analyzeJitter(),
            timeCorrelation: this.analyzeTimeCorrelation(),
            patterns: this.detectTimingPatterns(),
            predictability: this.calculatePredictabilityScore()
        };
    }

    /**
     * 1. ANÁLISE DE INTERVALOS
     * Detecta padrões nos intervalos entre rodadas
     */
    analyzeIntervals() {
        const intervals = [];
        for (let i = 1; i < this.timings.length; i++) {
            const interval = Number(this.timings[i].startTime - this.timings[i - 1].startTime);
            intervals.push(interval);
        }

        // Estatísticas
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / mean; // Coeficiente de variação

        // Detecta outliers
        const outliers = intervals.filter(iv => Math.abs(iv - mean) > 3 * stdDev);
        const outlierRate = outliers.length / intervals.length;

        // Histograma de intervalos
        const histogram = this.createIntervalHistogram(intervals);

        // Detecta regularidade
        const isRegular = cv < 0.05; // Menos de 5% de variação
        const isSemiRegular = cv < 0.15;

        return {
            mean: mean,
            stdDev: stdDev,
            cv: cv,
            min: Math.min(...intervals),
            max: Math.max(...intervals),
            isRegular: isRegular,
            isSemiRegular: isSemiRegular,
            outlierRate: outlierRate,
            histogram: histogram,
            interpretation: this.interpretIntervals(cv, outlierRate)
        };
    }

    /**
     * 2. DETECÇÃO DE PERIODICIDADE
     * Usa autocorrelação para encontrar ciclos
     */
    detectPeriodicity() {
        const intervals = this.timings.map((t, i) => {
            if (i === 0) return 0;
            return Number(t.startTime - this.timings[i - 1].startTime);
        }).slice(1);

        const n = intervals.length;
        const maxLag = Math.min(100, Math.floor(n / 2));

        // Calcula autocorrelação para diferentes lags
        const autocorrelations = [];
        for (let lag = 1; lag <= maxLag; lag++) {
            let sum = 0;
            for (let i = 0; i < n - lag; i++) {
                sum += intervals[i] * intervals[i + lag];
            }
            const ac = sum / (n - lag);
            autocorrelations.push({ lag, value: ac });
        }

        // Encontra picos
        const peaks = [];
        for (let i = 1; i < autocorrelations.length - 1; i++) {
            if (autocorrelations[i].value > autocorrelations[i - 1].value &&
                autocorrelations[i].value > autocorrelations[i + 1].value &&
                autocorrelations[i].value > 0.5) {
                peaks.push(autocorrelations[i]);
            }
        }

        // Ordena por força
        peaks.sort((a, b) => b.value - a.value);

        const hasPeriodicity = peaks.length > 0;
        const dominantPeriod = peaks.length > 0 ? peaks[0].lag : null;

        return {
            hasPeriodicity: hasPeriodicity,
            dominantPeriod: dominantPeriod,
            peaks: peaks.slice(0, 5),
            strength: peaks.length > 0 ? peaks[0].value : 0,
            interpretation: hasPeriodicity
                ? `Periodicidade detectada: ciclo de ${dominantPeriod} rodadas`
                : 'Sem periodicidade clara detectada'
        };
    }

    /**
     * 3. ANÁLISE DE JITTER
     * Variação no timing pode indicar RNG fraco
     */
    analyzeJitter() {
        const intervals = this.timings.map((t, i) => {
            if (i === 0) return 0;
            return Number(t.startTime - this.timings[i - 1].startTime);
        }).slice(1);

        // Calcula jitter (diferença entre intervalos consecutivos)
        const jitter = [];
        for (let i = 1; i < intervals.length; i++) {
            jitter.push(Math.abs(intervals[i] - intervals[i - 1]));
        }

        const meanJitter = jitter.reduce((a, b) => a + b, 0) / jitter.length;
        const maxJitter = Math.max(...jitter);
        const minJitter = Math.min(...jitter);

        // Distribuição do jitter
        const jitterThreshold = meanJitter * 2;
        const highJitterCount = jitter.filter(j => j > jitterThreshold).length;
        const highJitterRate = highJitterCount / jitter.length;

        // Detecta padrões no jitter
        const jitterSequence = jitter.map(j => j > meanJitter ? 1 : 0);
        const patternScore = this.detectBinaryPattern(jitterSequence);

        return {
            meanJitter: meanJitter,
            maxJitter: maxJitter,
            minJitter: minJitter,
            highJitterRate: highJitterRate,
            patternScore: patternScore,
            hasJitterPattern: patternScore > 0.6,
            interpretation: patternScore > 0.6
                ? 'Padrão detectado no jitter - RNG possivelmente fraco'
                : 'Jitter parece aleatório (esperado em RNG forte)'
        };
    }

    /**
     * 4. CORRELAÇÃO TEMPO-RESULTADO
     * Verifica se horário influencia resultado
     */
    analyzeTimeCorrelation() {
        const correlations = {
            hourOfDay: [],
            minuteOfHour: [],
            secondOfMinute: [],
            dayOfWeek: []
        };

        // Agrupa resultados por período
        this.timings.forEach(t => {
            const date = new Date(Math.floor(t.startTime / 1000));
            correlations.hourOfDay.push({
                time: date.getHours(),
                value: t.multiplier
            });
            correlations.minuteOfHour.push({
                time: date.getMinutes(),
                value: t.multiplier
            });
            correlations.secondOfMinute.push({
                time: date.getSeconds(),
                value: t.multiplier
            });
            correlations.dayOfWeek.push({
                time: date.getDay(),
                value: t.multiplier
            });
        });

        // Calcula correlação para cada período
        const analyze = (data) => {
            const groups = {};
            data.forEach(d => {
                if (!groups[d.time]) groups[d.time] = [];
                groups[d.time].push(d.value);
            });

            // Média por grupo
            const means = Object.entries(groups).map(([time, values]) => ({
                time: parseInt(time),
                mean: values.reduce((a, b) => a + b, 0) / values.length,
                count: values.length
            }));

            // Variância entre médias
            const overallMean = means.reduce((a, m) => a + m.mean * m.count, 0) / data.length;
            const betweenVariance = means.reduce((acc, m) => 
                acc + m.count * Math.pow(m.mean - overallMean, 2), 0) / data.length;

            return {
                correlation: Math.sqrt(betweenVariance),
                groups: means.filter(m => m.count >= 5).sort((a, b) => b.mean - a.mean).slice(0, 5),
                hasCorrelation: betweenVariance > 0.5
            };
        };

        return {
            hourOfDay: analyze(correlations.hourOfDay),
            minuteOfHour: analyze(correlations.minuteOfHour),
            interpretation: 'Verifica se horários específicos têm multiplicadores diferentes'
        };
    }

    /**
     * 5. DETECÇÃO DE PADRÕES COMPLEXOS
     * Usa múltiplas heurísticas
     */
    detectTimingPatterns() {
        if (this.timings.length < 200) {
            return { status: 'INSUFFICIENT_DATA' };
        }

        const patterns = [];

        // Padrão 1: Intervalos idênticos
        const intervals = this.timings.map((t, i) => {
            if (i === 0) return 0;
            return Math.round(Number(t.startTime - this.timings[i - 1].startTime));
        }).slice(1);

        const intervalFrequency = {};
        intervals.forEach(iv => {
            intervalFrequency[iv] = (intervalFrequency[iv] || 0) + 1;
        });

        const mostCommon = Object.entries(intervalFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const mostCommonRate = mostCommon[0][1] / intervals.length;
        if (mostCommonRate > 0.3) {
            patterns.push({
                type: 'REPEATING_INTERVAL',
                interval: mostCommon[0][0],
                rate: mostCommonRate,
                strength: 'HIGH'
            });
        }

        // Padrão 2: Sequência alternante
        const alternating = this.detectAlternating(intervals);
        if (alternating.score > 0.7) {
            patterns.push({
                type: 'ALTERNATING_PATTERN',
                score: alternating.score,
                strength: alternating.score > 0.9 ? 'VERY_HIGH' : 'HIGH'
            });
        }

        // Padrão 3: Gradual increase/decrease
        const trend = this.detectTrend(intervals);
        if (trend.strength > 0.6) {
            patterns.push({
                type: 'TREND_PATTERN',
                direction: trend.direction,
                strength: trend.strength > 0.8 ? 'VERY_HIGH' : 'HIGH'
            });
        }

        return {
            patterns: patterns,
            hasPatterns: patterns.length > 0,
            count: patterns.length
        };
    }

    /**
     * 6. SCORE DE PREVISIBILIDADE
     * Quão previsível é o timing?
     */
    calculatePredictabilityScore() {
        const intervals = this.timings.map((t, i) => {
            if (i === 0) return 0;
            return Number(t.startTime - this.timings[i - 1].startTime);
        }).slice(1);

        let score = 100; // Começa como totalmente previsível

        // Penaliza variação
        const cv = this.calculateCV(intervals);
        score -= cv * 50; // Se CV > 2, zera

        // Penaliza ausência de padrões
        const patterns = this.detectTimingPatterns();
        if (patterns.count === 0) score -= 30;

        // Penaliza jitter alto
        const jitter = this.analyzeJitter();
        if (!jitter.hasJitterPattern) score -= 20;

        // Bonus por padrões detectados
        score += patterns.count * 10;

        score = Math.max(0, Math.min(100, Math.round(score)));

        let level;
        if (score >= 80) level = 'HIGHLY_PREDICTABLE';
        else if (score >= 60) level = 'PREDICTABLE';
        else if (score >= 40) level = 'PARTIALLY_PREDICTABLE';
        else if (score >= 20) level = 'HARDLY_PREDICTABLE';
        else level = 'UNPREDICTABLE';

        return {
            score: score,
            level: level,
            interpretation: this.interpretPredictability(score, level)
        };
    }

    // ==================== HELPERS ====================

    createIntervalHistogram(intervals, bins = 20) {
        const min = Math.min(...intervals);
        const max = Math.max(...intervals);
        const binWidth = (max - min) / bins;
        const histogram = new Array(bins).fill(0);

        intervals.forEach(iv => {
            const bin = Math.min(Math.floor((iv - min) / binWidth), bins - 1);
            histogram[bin]++;
        });

        return histogram;
    }

    detectAlternating(intervals) {
        let alternations = 0;
        for (let i = 1; i < intervals.length; i++) {
            if ((intervals[i] > intervals[i - 1]) !== (intervals[i - 1] > intervals[i - 2])) {
                alternations++;
            }
        }
        const score = alternations / (intervals.length - 2);
        return { score, alternations };
    }

    detectTrend(intervals) {
        const n = intervals.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += intervals[i];
            sumXY += i * intervals[i];
            sumX2 += i * i;
        }
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const normalizedSlope = Math.abs(slope) / (sumY / n);
        
        return {
            strength: Math.min(1, normalizedSlope),
            direction: slope > 0 ? 'INCREASING' : 'DECREASING'
        };
    }

    detectBinaryPattern(sequence) {
        // Detecta padrões em sequência binária
        const n = sequence.length;
        const patternLengths = [2, 3, 4, 5];
        let maxScore = 0;

        for (const len of patternLengths) {
            const patterns = {};
            
            for (let i = 0; i <= n - len; i++) {
                const pattern = sequence.slice(i, i + len).join('');
                patterns[pattern] = (patterns[pattern] || 0) + 1;
            }

            const total = n - len + 1;
            const maxFreq = Math.max(...Object.values(patterns));
            const score = maxFreq / total;
            maxScore = Math.max(maxScore, score);
        }

        return maxScore;
    }

    calculateCV(arr) {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;
        const stdDev = Math.sqrt(variance);
        return stdDev / mean;
    }

    interpretIntervals(cv, outlierRate) {
        if (cv < 0.05) return 'Intervalos extremamente regulares - possível timer determinístico';
        if (cv < 0.15) return 'Intervalos semi-regulares - algum padrão temporal';
        if (outlierRate > 0.1) return 'Muitos outliers - timing instável';
        return 'Intervalos variáveis - esperado em RNG forte';
    }

    interpretPredictability(score, level) {
        if (score >= 80) return `Timing ALTAMENTE previsível (${level}) - possível exploração`;
        if (score >= 60) return `Timing previsível (${level}) - vale a pena explorar`;
        if (score >= 40) return `Parcialmente previsível (${level}) - algum padrão`;
        if (score >= 20) return `Difícil de prever (${level}) - RNG parece forte`;
        return `Imprevisível (${level}) - sem padrões temporais detectados`;
    }
}

module.exports = TimingAttackAnalyzer;
