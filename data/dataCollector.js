/**
 * Coletor Massivo de Dados Aviator
 * 
 * Coleta e armazena TODOS os dados possíveis do jogo:
 * - Multiplicadores de cada rodada
 * - Timestamps com precisão de milissegundos
 * - Seeds públicas (client_seed, server_seed_hash)
 * - Timing entre rodadas
 * - Estado completo do jogo
 * 
 * Dados armazenados em SQLite para análise posterior
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../util/logger');
const fs = require('fs');

class DataCollector {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, '../data/aviator_data.db');
        this.db = null;
        this.initialized = false;
        this.collectionStats = {
            totalRounds: 0,
            startTime: null,
            lastRound: null,
            collectionRate: 0
        };
        
        // Garante que diretório existe
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
    }

    /**
     * Inicializa banco de dados e cria tabelas
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logger.error(`Erro ao abrir banco: ${err.message}`);
                    reject(err);
                    return;
                }
                logger.info(`Banco de dados aberto: ${this.dbPath}`);
            });

            // Habilita WAL mode para melhor performance
            this.db.run('PRAGMA journal_mode=WAL', (err) => {
                if (err) logger.error(`Erro WAL: ${err.message}`);
            });

            // Cria tabelas
            this.createTables()
                .then(() => {
                    this.initialized = true;
                    this.collectionStats.startTime = Date.now();
                    logger.info('✅ Banco de dados inicializado');
                    resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Cria todas as tabelas necessárias
     */
    async createTables() {
        const queries = [
            // Tabela principal de rodadas
            `CREATE TABLE IF NOT EXISTS rounds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                round_id TEXT UNIQUE,
                multiplier REAL NOT NULL,
                timestamp_ms INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Tabela de seeds
            `CREATE TABLE IF NOT EXISTS seeds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                round_id TEXT,
                client_seed TEXT,
                server_seed_hash TEXT,
                nonce INTEGER,
                timestamp_ms INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (round_id) REFERENCES rounds(round_id)
            )`,

            // Tabela de timing
            `CREATE TABLE IF NOT EXISTS timing_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                round_id TEXT,
                round_start_ms INTEGER,
                round_end_ms INTEGER,
                duration_ms INTEGER,
                gap_to_next_ms INTEGER,
                timestamp_ms INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (round_id) REFERENCES rounds(round_id)
            )`,

            // Tabela de estado do jogo
            `CREATE TABLE IF NOT EXISTS game_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                round_id TEXT,
                phase TEXT,
                players_count INTEGER,
                total_bets REAL,
                timestamp_ms INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (round_id) REFERENCES rounds(round_id)
            )`,

            // Tabela de previsões e acertos
            `CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                round_id TEXT,
                predicted_value REAL,
                actual_value REAL,
                confidence REAL,
                accuracy REAL,
                methods_used TEXT,
                rng_score REAL,
                timestamp_ms INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (round_id) REFERENCES rounds(round_id)
            )`,

            // View para análise
            `CREATE VIEW IF NOT EXISTS round_analysis AS
                SELECT 
                    r.id,
                    r.round_id,
                    r.multiplier,
                    r.timestamp_ms,
                    s.client_seed,
                    s.server_seed_hash,
                    s.nonce,
                    t.duration_ms,
                    t.gap_to_next_ms,
                    p.predicted_value,
                    p.accuracy
                FROM rounds r
                LEFT JOIN seeds s ON r.round_id = s.round_id
                LEFT JOIN timing_data t ON r.round_id = t.round_id
                LEFT JOIN predictions p ON r.round_id = p.round_id
                ORDER BY r.timestamp_ms DESC`
        ];

        for (const query of queries) {
            await this.run(query);
        }

        // Cria índices para performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_rounds_timestamp ON rounds(timestamp_ms)',
            'CREATE INDEX IF NOT EXISTS idx_rounds_multiplier ON rounds(multiplier)',
            'CREATE INDEX IF NOT EXISTS idx_seeds_round ON seeds(round_id)',
            'CREATE INDEX IF NOT EXISTS idx_timing_round ON timing_data(round_id)',
            'CREATE INDEX IF NOT EXISTS idx_predictions_round ON predictions(round_id)'
        ];

        for (const index of indexes) {
            await this.run(index);
        }

        logger.info('✅ Tabelas e índices criados');
    }

    /**
     * Executa query SQL
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this);
            });
        });
    }

    /**
     * Query que retorna múltiplos registros
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    /**
     * Query que retorna único registro
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    }

    /**
     * Salva rodada completa no banco
     */
    async saveRound(data) {
        if (!this.initialized) {
            await this.initialize();
        }

        const {
            roundId,
            multiplier,
            timestamp,
            clientSeed,
            serverSeedHash,
            nonce,
            duration,
            gapToNext,
            gameState
        } = data;

        try {
            // Salva rodada
            await this.run(
                `INSERT OR IGNORE INTO rounds (round_id, multiplier, timestamp_ms) 
                 VALUES (?, ?, ?)`,
                [roundId, multiplier, timestamp]
            );

            // Salva seed
            if (clientSeed || serverSeedHash) {
                await this.run(
                    `INSERT OR IGNORE INTO seeds 
                     (round_id, client_seed, server_seed_hash, nonce, timestamp_ms) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [roundId, clientSeed, serverSeedHash, nonce, timestamp]
                );
            }

            // Salva timing
            if (duration !== undefined) {
                await this.run(
                    `INSERT OR IGNORE INTO timing_data 
                     (round_id, round_start_ms, round_end_ms, duration_ms, gap_to_next_ms, timestamp_ms) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [roundId, timestamp - duration, timestamp, duration, gapToNext, timestamp]
                );
            }

            // Salva game state
            if (gameState) {
                await this.run(
                    `INSERT OR IGNORE INTO game_state 
                     (round_id, phase, players_count, total_bets, timestamp_ms) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [roundId, gameState.phase, gameState.players, gameState.totalBets, timestamp]
                );
            }

            this.collectionStats.totalRounds++;
            this.collectionStats.lastRound = Date.now();
            this.collectionStats.collectionRate = this.collectionStats.totalRounds / 
                ((Date.now() - this.collectionStats.startTime) / 1000 / 60);

            logger.debug(`💾 Rodada salva: ${multiplier}x | Total: ${this.collectionStats.totalRounds}`);

            return true;
        } catch (error) {
            logger.error(`Erro ao salvar rodada: ${error.message}`);
            return false;
        }
    }

    /**
     * Salva previsão e resultado
     */
    async savePrediction(data) {
        const {
            roundId,
            predicted,
            actual,
            confidence,
            accuracy,
            methods,
            rngScore
        } = data;

        await this.run(
            `INSERT INTO predictions 
             (round_id, predicted_value, actual_value, confidence, accuracy, methods_used, rng_score, timestamp_ms) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [roundId, predicted, actual, confidence, accuracy, JSON.stringify(methods), rngScore, Date.now()]
        );

        logger.debug(`🎯 Previsão salva: prev=${predicted}x real=${actual}x acc=${accuracy}`);
    }

    /**
     * Obtém últimas N rodadas para análise
     */
    async getRecentRounds(limit = 100) {
        return await this.all(
            'SELECT * FROM rounds ORDER BY timestamp_ms DESC LIMIT ?',
            [limit]
        );
    }

    /**
     * Obtém todas as seeds coletadas
     */
    async getAllSeeds() {
        return await this.all(
            'SELECT * FROM seeds ORDER BY timestamp_ms DESC'
        );
    }

    /**
     * Obtém estatísticas de timing
     */
    async getTimingStats() {
        return await this.all(
            `SELECT 
                AVG(duration_ms) as avg_duration,
                MIN(duration_ms) as min_duration,
                MAX(duration_ms) as max_duration,
                AVG(gap_to_next_ms) as avg_gap,
                COUNT(*) as total_rounds
             FROM timing_data`
        );
    }

    /**
     * Obtém acurácia das previsões
     */
    async getPredictionAccuracy() {
        return await this.all(
            `SELECT 
                COUNT(*) as total_predictions,
                AVG(accuracy) as avg_accuracy,
                AVG(CASE WHEN accuracy > 0.7 THEN 1 ELSE 0 END) as high_accuracy_rate,
                AVG(rng_score) as avg_rng_score
             FROM predictions`
        );
    }

    /**
     * Exporta dados para CSV
     */
    async exportToCSV(filePath) {
        const rows = await this.all(
            'SELECT * FROM round_analysis ORDER BY timestamp_ms DESC'
        );

        if (rows.length === 0) {
            logger.warn('Sem dados para exportar');
            return;
        }

        const headers = Object.keys(rows[0]).join(',');
        const csvRows = rows.map(row => Object.values(row).join(','));
        const csv = [headers, ...csvRows].join('\n');

        fs.writeFileSync(filePath, csv);
        logger.info(`📄 Dados exportados para ${filePath} (${rows.length} registros)`);
    }

    /**
     * Obtém estatísticas completas da coleta
     */
    getCollectionStats() {
        return {
            ...this.collectionStats,
            uptime: this.collectionStats.startTime 
                ? (Date.now() - this.collectionStats.startTime) / 1000 
                : 0,
            databaseSize: fs.existsSync(this.dbPath) 
                ? (fs.statSync(this.dbPath).size / 1024 / 1024).toFixed(2) + ' MB'
                : '0 MB'
        };
    }

    /**
     * Fecha conexão com banco
     */
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    logger.info('Banco de dados fechado');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = new DataCollector();
