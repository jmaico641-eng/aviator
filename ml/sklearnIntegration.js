const { PythonShell } = require('python-shell');
const path = require('path');
const logger = require('../util/logger');
const fs = require('fs');
const { spawn } = require('child_process');

class ScikitLearnIntegration {
    constructor() {
        this.pythonPath = this.findPython();
        this.scriptPath = path.join(__dirname, 'aviator_ml.py');
        this.isAvailable = false;
        
        // Não chama automaticamente - será chamado quando necessário
    }

    findPython() {
        const possiblePaths = [
            path.join(__dirname, '..', 'venv', 'bin', 'python3'),
            path.join(__dirname, '..', 'venv', 'bin', 'python'),
            '/usr/bin/python3',
            '/usr/bin/python'
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                logger.info(`✅ Python encontrado: ${p}`);
                return p;
            }
        }

        logger.warn('⚠️ Python não encontrado, usando python3 do PATH');
        return 'python3';
    }

    async checkAvailability() {
        try {
            const result = await this.runPythonCommand('-c', 'import sklearn; import numpy; import pandas; print("OK")');
            this.isAvailable = result.includes('OK');
            
            if (this.isAvailable) {
                logger.info('✅ Scikit-Learn disponível e funcionando');
            }
            return this.isAvailable;
        } catch (error) {
            logger.warn(`⚠️ Scikit-Learn não disponível: ${error.message}`);
            this.isAvailable = false;
            return false;
        }
    }

    runPythonCommand(arg, value) {
        return new Promise((resolve, reject) => {
            const proc = spawn(this.pythonPath, [arg, value], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            proc.stdout.on('data', (data) => {
                output += data.toString();
            });

            proc.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(errorOutput));
                }
            });

            proc.on('error', reject);
        });
    }

    async trainModels(multipliers) {
        if (!this.isAvailable) {
            logger.warn('Scikit-Learn não disponível, pulando treino');
            return null;
        }

        if (multipliers.length < 30) {
            logger.warn(`Dados insuficientes para ML: ${multipliers.length} (mínimo 30)`);
            return null;
        }

        logger.info(`\n🐍 Iniciando treino com Scikit-Learn (${multipliers.length} amostras)...`);

        const inputData = JSON.stringify({
            action: 'train',
            multipliers: multipliers
        });

        try {
            const result = await this.runPythonScript(inputData);
            
            if (result && result.status === 'success') {
                logger.info('✅ Treino Scikit-Learn concluído!');
                
                if (result.performance) {
                    logger.info('📊 Performance dos modelos:');
                    for (const [model, metrics] of Object.entries(result.performance)) {
                        logger.info(`   ${model}: ${(metrics.cv_accuracy * 100).toFixed(1)}% ± ${(metrics.cv_std * 100).toFixed(1)}%`);
                    }
                }
                
                return result;
            } else {
                logger.error(`Erro no treino: ${result?.message || 'Desconhecido'}`);
                return null;
            }
        } catch (error) {
            logger.error(`Erro ao treinar modelos: ${error.message}`);
            return null;
        }
    }

    async predict(multipliers) {
        if (!this.isAvailable) {
            return null;
        }

        const inputData = JSON.stringify({
            action: 'predict',
            multipliers: multipliers
        });

        try {
            const result = await this.runPythonScript(inputData);
            
            if (result && result.status === 'success') {
                return {
                    classification: result.classification,
                    regression: result.regression
                };
            }
            
            return null;
        } catch (error) {
            logger.error(`Erro na previsão ML: ${error.message}`);
            return null;
        }
    }

    async getPerformanceReport() {
        if (!this.isAvailable) {
            return null;
        }

        const inputData = JSON.stringify({
            action: 'report'
        });

        try {
            const result = await this.runPythonScript(inputData);
            return result?.report || null;
        } catch (error) {
            logger.error(`Erro ao obter relatório: ${error.message}`);
            return null;
        }
    }

    runPythonScript(inputData) {
        return new Promise((resolve, reject) => {
            const proc = spawn(this.pythonPath, [this.scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            proc.stdout.on('data', (data) => {
                output += data.toString();
            });

            proc.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            proc.on('close', (code) => {
                if (code !== 0) {
                    logger.debug(`Python exited with code ${code}`);
                }

                try {
                    const lines = output.trim().split('\n');
                    const lastLine = lines[lines.length - 1];
                    const result = JSON.parse(lastLine);
                    resolve(result);
                } catch (e) {
                    resolve({ raw: output, error: errorOutput });
                }
            });

            proc.on('error', reject);

            proc.stdin.write(inputData + '\n');
            proc.stdin.end();
        });
    }

    getStatus() {
        return {
            available: this.isAvailable,
            pythonPath: this.pythonPath,
            scriptPath: this.scriptPath
        };
    }
}

module.exports = new ScikitLearnIntegration();
