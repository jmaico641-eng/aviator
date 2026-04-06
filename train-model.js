/**
 * Script para treinar a rede neural com dados históricos
 * Uso: node train-model.js
 */

const DataCollector = require('./data/dataCollector');
const NeuralNetworkPredictor = require('./ml/neuralNetwork');
const logger = require('./util/logger');

async function trainModel() {
    try {
        logger.info('🧠 TREINANDO MODELO NEURAL COM DADOS HISTÓRICOS');
        logger.info('═'.repeat(60));

        // Inicializa banco
        await DataCollector.initialize();

        // Obtém dados históricos
        const rounds = await DataCollector.getRecentRounds(10000);
        logger.info(`📊 Dados obtidos: ${rounds.length} rodadas`);

        if (rounds.length < 30) {
            logger.error('Dados insuficientes para treino (mínimo 30 rodadas)');
            logger.info('Execute o bot primeiro para coletar dados');
            process.exit(1);
        }

        // Extrai multiplicadores
        const multipliers = rounds.map(r => r.multiplier).reverse();
        logger.info(`📈 Multiplicadores: ${multipliers.length} valores`);
        logger.info(`   Média: ${(multipliers.reduce((a,b) => a+b,0) / multipliers.length).toFixed(2)}x`);
        logger.info(`   Máx: ${Math.max(...multipliers)}x`);
        logger.info(`   Mín: ${Math.min(...multipliers)}x`);

        // Cria e treina modelo
        const nn = new NeuralNetworkPredictor({
            sequenceLength: 20,
            epochs: 100,
            batchSize: 32,
            learningRate: 0.001
        });

        logger.info('\n⚙️ Iniciando treino...');
        const history = await nn.train(multipliers, [], 100);

        if (history) {
            logger.info('\n✅ TREINO CONCLUÍDO!');
            
            // Salva modelo
            await nn.saveModel();
            logger.info('💾 Modelo salvo em ./models/neural-network');

            // Mostra métricas
            const metrics = nn.getMetrics();
            logger.info(`📊 Total de previsões: ${metrics.totalPredictions}`);
            logger.info(`📊 Amostras de treino: ${metrics.trainingSamples}`);
        }

        // Testa previsão
        logger.info('\n🎯 TESTANDO PREVISÃO:');
        const testMultipliers = multipliers.slice(-50);
        const prediction = nn.predict(testMultipliers);
        
        if (prediction) {
            logger.info(`   Previsto: ${prediction.value.toFixed(2)}x`);
            logger.info(`   Confiança: ${(prediction.confidence * 100).toFixed(1)}%`);
            logger.info(`   Incerteza: ±${prediction.uncertainty.toFixed(2)}`);
        }

        await DataCollector.close();
        process.exit(0);

    } catch (error) {
        logger.error(`Erro no treino: ${error.message}`);
        logger.error(error.stack);
        process.exit(1);
    }
}

trainModel();
