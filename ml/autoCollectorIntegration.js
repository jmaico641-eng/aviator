/**
 * Integrador do Coletor Automático de Seeds
 * 
 * Conecta Node.js com Python auto_collector.py
 * Coleta seeds automaticamente e prevê resultados
 */

const { spawn } = require('child_process');
const path = require('path');
const logger = require('../util/logger');
const fs = require('fs');

class AutoCollectorIntegration {
    constructor() {
        this.pythonPath = this.findPython();
        this.scriptPath = path.join(__dirname, 'auto_collector.py');
        this.isAvailable = false;
        this.collectedRounds = [];
        this.currentPrediction = null;
        this.stats = {
            totalCollected: 0,
            seedsRevealed: 0,
            patternDetected: false,
            predictions: 0
        };
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
                logger.info('✅ Auto Collector Python pronto');
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
     * Adiciona rodada coletada ao sistema
     */
    addRound(roundData) {
        this.collectedRounds.push(roundData);
        this.stats.totalCollected++;
        
        if (roundData.server_seed) {
            this.stats.seedsRevealed++;
            logger.info(`🔑 Seed revelado #${this.stats.seedsRevealed}: Round ${roundData.round_id}`);
        }
    }

    /**
     * Processa rodadas e obtém previsão
     */
    async getPrediction() {
        if (!this.isAvailable || this.collectedRounds.length === 0) {
            return null;
        }

        const inputData = JSON.stringify({
            action: 'get_prediction',
            history: this.collectedRounds
        });

        try {
            const result = await this.runPythonScript(inputData);
            
            if (result?.status === 'success' && result.prediction) {
                this.currentPrediction = result.prediction;
                this.stats.predictions++;
                
                // Log detalhado
                logger.info('\n🎯 PREVISÃO AUTOMÁTICA:');
                logger.info(`   Tipo: ${result.prediction.type}`);
                logger.info(`   Confiança: ${(result.prediction.confidence * 100).toFixed(1)}%`);
                logger.info(`   Recomendação: ${result.prediction.recommendation}`);
                
                if (result.prediction.predicted_multiplier) {
                    logger.info(`   Multiplicador previsto: ${result.prediction.predicted_multiplier}x`);
                }
                
                if (result.stats?.collector_stats?.pattern_detected) {
                    logger.warn(`   ⚠️ PADRÃO DETECTADO: ${result.stats.collector_stats.pattern_method}`);
                    this.stats.patternDetected = true;
                }

                return result;
            }
            
            return null;
        } catch (err) {
            logger.error(`Erro previsão: ${err.message}`);
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
            proc.on('close', () => {
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

    getDashboardData() {
        return {
            stats: this.stats,
            currentPrediction: this.currentPrediction,
            collectedRounds: this.collectedRounds.length,
            canPredict: this.stats.seedsRevealed >= 10
        };
    }
}

module.exports = new AutoCollectorIntegration();
