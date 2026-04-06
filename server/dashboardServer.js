/**
 * Servidor Web para Dashboard de Previsões
 * Serve a interface web e envia dados em tempo real via Socket.io
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const logger = require('../util/logger');

class DashboardServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        this.port = process.env.DASHBOARD_PORT || 3000;
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    setupRoutes() {
        // Serve static files
        this.app.use(express.static(path.join(__dirname, '../public')));

        // API endpoints
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', timestamp: Date.now() });
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            logger.info(`Dashboard conectado: ${socket.id}`);

            socket.on('disconnect', () => {
                logger.info(`Dashboard desconectado: ${socket.id}`);
            });
        });
    }

    // Envia nova previsão para todos os clientes
    broadcastPrediction(prediction) {
        this.io.emit('prediction', prediction);
    }

    // Envia novo multiplicador
    broadcastMultiplier(data) {
        this.io.emit('newMultiplier', data);
    }

    // Envia estatísticas atualizadas
    broadcastStats(stats) {
        this.io.emit('stats', stats);
    }

    // Envia histórico de previsões
    broadcastHistory(history) {
        this.io.emit('history', history.slice(-20)); // Últimas 20
    }

    start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, () => {
                logger.info(`🌐 Dashboard disponível em: http://localhost:${this.port}`);
                resolve();
            }).on('error', reject);
        });
    }

    stop() {
        return new Promise((resolve) => {
            this.server.close(() => {
                logger.info('Dashboard server stopped');
                resolve();
            });
        });
    }
}

module.exports = new DashboardServer();
