/**
 * Provably Fair Extractor
 * 
 * Extrai TODAS as informações de Provably Fair da página do Aviator:
 * - client_seed
 * - server_seed_hash
 * - nonce
 * - server_seed (revelado após jogo)
 * 
 * Estes dados são CRUCIAIS para:
 * 1. Analisar padrão de geração de seeds
 * 2. Prever próximos server_seeds
 * 3. Calcular resultados EXATOS
 */

const logger = require('../util/logger');

class ProvablyFairExtractor {
    constructor(page) {
        this.page = page;
        this.extractedData = [];
        this.revealedSeeds = [];
    }

    /**
     * Extrai informações de Provably Fair da página
     */
    async extractFairInfo() {
        try {
            // Tenta múltiplos seletores
            const selectors = {
                clientSeed: [
                    '[data-client-seed]',
                    '.client-seed',
                    '[class*="clientSeed"]',
                    'input[name="client_seed"]'
                ],
                serverSeedHash: [
                    '[data-server-seed]',
                    '.server-seed-hash',
                    '[class*="serverSeed"]',
                    'input[name="server_seed_hash"]'
                ],
                nonce: [
                    '[data-nonce]',
                    '.nonce',
                    '[class*="nonce"]',
                    'input[name="nonce"]'
                ],
                revealedSeed: [
                    '[data-revealed-seed]',
                    '.revealed-seed',
                    '[class*="revealedSeed"]',
                    '.fairness-history [class*="seed"]'
                ]
            };

            const info = {};

            // Extrai cada campo
            for (const [field, sels] of Object.entries(selectors)) {
                for (const sel of sels) {
                    try {
                        const value = await this.page.evaluate((selector) => {
                            const el = document.querySelector(selector);
                            return el ? (el.value || el.textContent || el.dataset.seed || el.dataset.hash || '').trim() : null;
                        }, sel);

                        if (value) {
                            info[field] = value;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            // Tenta extrair de iframes também
            if (!info.clientSeed) {
                for (const frame of this.page.frames()) {
                    try {
                        const frameInfo = await frame.evaluate(() => {
                            const inputs = document.querySelectorAll('input');
                            for (const input of inputs) {
                                if (input.name?.includes('seed') || input.dataset?.seed) {
                                    return {
                                        clientSeed: input.value || input.dataset.seed,
                                        serverSeedHash: input.dataset?.hash
                                    };
                                }
                            }
                            return null;
                        });

                        if (frameInfo?.clientSeed) {
                            Object.assign(info, frameInfo);
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            // Salva extração
            if (info.clientSeed || info.serverSeedHash) {
                const record = {
                    ...info,
                    timestamp: Date.now(),
                    roundNumber: this.extractedData.length + 1
                };
                this.extractedData.push(record);

                // Se server_seed foi revelado
                if (info.revealedSeed || info.serverSeed) {
                    this.revealedSeeds.push(record);
                    logger.info(`🔑 Server seed revelado #${this.revealedSeeds.length}`);
                }
            }

            return info;
        } catch (error) {
            logger.debug(`Erro na extração PF: ${error.message}`);
            return {};
        }
    }

    /**
     * Extrai histórico completo de Provably Fair
     * (Muitas casas têm página de histórico)
     */
    async extractFairHistory() {
        try {
            // Navega para página de histórico se existir
            const historyUrl = await this.page.evaluate(() => {
                const links = document.querySelectorAll('a');
                for (const link of links) {
                    const text = (link.textContent || '').toLowerCase();
                    if (text.includes('provably') || text.includes('fair') || text.includes('histórico')) {
                        return link.href;
                    }
                }
                return null;
            });

            if (historyUrl) {
                logger.info(`Encontrada página de histórico: ${historyUrl}`);
                await this.page.goto(historyUrl, { waitUntil: 'networkidle0', timeout: 30000 });

                // Extrai tabela de histórico
                const history = await this.page.evaluate(() => {
                    const rows = document.querySelectorAll('table tr, .history-item, [class*="round"]');
                    const data = [];

                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td, span, div');
                        const record = {};
                        cells.forEach((cell, i) => {
                            const text = cell.textContent.trim();
                            if (text.length > 10 && (text.includes('seed') || /^[a-f0-9]{32,}$/.test(text))) {
                                record[`field_${i}`] = text;
                            }
                        });

                        if (Object.keys(record).length > 0) {
                            data.push(record);
                        }
                    });

                    return data;
                });

                logger.info(`Extraídos ${history.length} registros do histórico`);
                return history;
            }

            return [];
        } catch (error) {
            logger.debug(`Erro na extração de histórico: ${error.message}`);
            return [];
        }
    }

    /**
     * Retorna estatísticas da extração
     */
    getExtractionStats() {
        return {
            totalExtractions: this.extractedData.length,
            revealedSeeds: this.revealedSeeds.length,
            progressToAnalysis: Math.min(100, (this.revealedSeeds.length / 100) * 100),
            canPredict: this.revealedSeeds.length >= 10
        };
    }

    /**
     * Exporta dados para análise Python
     */
    exportForPython() {
        return {
            seeds_history: this.extractedData,
            revealed_seeds: this.revealedSeeds
        };
    }
}

module.exports = ProvablyFairExtractor;
