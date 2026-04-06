/**
 * Integração com Ultimate Predictor Python
 * 
 * Sistema HÍBRIDO que combina:
 * 1. Previsão exata de seeds (99%+)
 * 2. ML Ensemble (13 modelos)
 * 3. RNG Analysis
 * 4. Timing Attack
 * 
 * Só aposta se confiança >= 95%
 */

const { spawn } = require('child_process');
const path = require('path');
const logger = require('../util/logger');
const fs = require('fs');

class UltimatePredictorIntegration {
    constructor() {
        this.pythonPath = this.findPython();
        this.scriptPath = path.join(__dirname, 'ultimate_predictor.py');
        this.isAvailable = false;
        this.predictionHistory = [];
        this.minConfidence = 0.95; // Só aposta com 95%+ confiança
    }

    findPython() {
        const paths = [
            path.join(__dirname, '..', 'venv', 'bin', 'python3'),
            path.join(__dirname, '..', 'venv', 'bin', 'python'),
            '/usr/bin/python3'
        ];
        
        for (const p of paths) {
            if (fs.existsSync(p)) return p;
        }
        return 'python3';
    }

    async checkAvailability() {
        try {
            const result = await this.runPythonCommand('-c', 'import sklearn; import numpy; import pandas; print("OK")');
            this.isAvailable = result.includes('OK');
            if (this.isAvailable) {
                logger.info('✅ Ultimate Predictor disponível');
            }
            return this.isAvailable;
        } catch {
            this.isAvailable = false;
            return false;
        }
    }

    runPythonCommand(arg, value) {
        return new Promise((resolve, reject) => {
            const proc = spawn(this.pythonPath, [arg, value], { stdio: ['pipe', 'pipe', 'pipe'] });
            let output = '';
            let error = '';
            proc.stdout.on('data', d => output += d.toString());
            proc.stderr.on('data', d => error += d.toString());
            proc.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
            proc.on('error', reject);
        });
    }

    /**
     * Analisa seeds de Provably Fair
     */
    async analyzeSeeds(seedsHistory) {
        if (!this.isAvailable) return null;

        const inputData = JSON.stringify({
            action: 'analyze_seeds',
            seeds_history: seedsHistory
        });

        try {
            const result = await this.runPythonScript(inputData);
            
            if (result?.status === 'success') {
                logger.info('\n🔍 ANÁLISE PROVABLY FAIR:');
                logger.info(`   Seeds revelados: ${result.seed_analysis?.revealed_seeds || 0}`);
                logger.info(`   Estratégia: ${result.strategy?.phase}`);
                logger.info(`   Progresso: ${result.strategy?.progress_to_99?.toFixed(0)}%`);
            }

            return result;
        } catch (err) {
            logger.error(`Erro análise seeds: ${err.message}`);
            return null;
        }
    }

    /**
     * Faz previsão HÍBRIDA
     */
    async predict(multipliers, seedsHistory = [], clientSeed = null, nonce = null) {
        if (!this.isAvailable) return null;

        const inputData = JSON.stringify({
            action: 'predict',
            history: seedsHistory,
            multipliers: multipliers,
            client_seed: clientSeed,
            nonce: nonce
        });

        try {
            const result = await this.runPythonScript(inputData);
            
            if (result?.status === 'success') {
                this.predictionHistory.push(result);
                
                // Log detalhado
                logger.info('\n🎯 ULTIMATE PREDICTION:');
                logger.info(`   Método: ${result.method}`);
                logger.info(`   Confiança: ${(result.confidence * 100).toFixed(1)}%`);
                logger.info(`   Recomendação: ${result.recommendation}`);
                logger.info(`   Razão: ${result.reason}`);

                if (result.predicted_multiplier) {
                    logger.info(`   Previsão exata: ${result.predicted_multiplier}x`);
                } else if (result.predicted_range) {
                    logger.info(`   Range: ${result.predicted_range.low?.toFixed(2)}x - ${result.predicted_range.high?.toFixed(2)}x`);
                }
            }

            return result;
        } catch (err) {
            logger.error(`Erro previsão ultimate: ${err.message}`);
            return null;
        }
    }

    /**
     * Calcula resultado EXATO dado server_seed
     */
    async calculateExactResult(serverSeed, clientSeed, nonce) {
        if (!this.isAvailable) return null;

        const inputData = JSON.stringify({
            action: 'calculate_exact',
            server_seed: serverSeed,
            client_seed: clientSeed,
            nonce: nonce
        });

        try {
            const result = await this.runPythonScript(inputData);
            
            if (result?.status === 'success') {
                logger.info(`\n✅ RESULTADO EXATO CALCULADO:`);
                logger.info(`   Multiplicador: ${result.multiplier}x`);
                logger.info(`   Hash: ${result.hash}`);
            }

            return result;
        } catch (err) {
            logger.error(`Erro cálculo exato: ${err.message}`);
            return null;
        }
    }

    runPythonScript(inputData) {
        return new Promise((resolve, reject) => {
            const proc = spawn(this.pythonPath, [this.scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
            let output = '';
            let error = '';
            proc.stdout.on('data', d => output += d.toString());
            proc.stderr.on('data', d => error += d.toString());
            proc.on('close', code => {
                try {
                    const lines = output.trim().split('\n');
                    const lastLine = lines[lines.length - 1];
                    resolve(JSON.parse(lastLine));
                } catch {
                    resolve({ raw: output, error });
                }
            });
            proc.on('error', reject);
            proc.stdin.write(inputData + '\n');
            proc.stdin.end();
        });
    }

    /**
     * Se deve apostar baseado na confiança
     */
    shouldBet(prediction) {
        if (!prediction) return false;
        
        // Precisa de confiança mínima
        if (prediction.confidence < this.minConfidence) {
            return false;
        }

        // Ou se é previsão exata de seed
        if (prediction.method === 'EXACT_SEED_PREDICTION') {
            return true;
        }

        return false;
    }

    getStats() {
        return {
            totalPredictions: this.predictionHistory.length,
            highConfidencePredictions: this.predictionHistory.filter(
                p => p.confidence >= this.minConfidence
            ).length,
            minConfidence: this.minConfidence,
            available: this.isAvailable
        };
    }
}

module.exports = new UltimatePredictorIntegration();
