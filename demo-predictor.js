/**
 * Demo do sistema de previsão Aviator
 * Testa o predictor com dados simulados para mostrar como funciona
 */

const AviatorPredictor = require('./prediction/aviatorPredictor');
const logger = require('./util/logger');

// Dados simulados de multiplicadores (como os do Aviator)
const simulatedData = [
    1.23, 1.45, 2.34, 1.12, 1.67,
    3.45, 1.89, 1.34, 2.12, 1.56,
    1.78, 4.23, 1.45, 1.23, 2.67,
    1.34, 1.89, 5.67, 1.12, 2.34,
    1.56, 1.78, 3.12, 1.45, 2.89
];

async function runDemo() {
    console.log('\n═══════════════════════════════════════════');
    console.log('   🔮 AVIATOR PREDICTOR - DEMONSTRAÇÃO');
    console.log('═══════════════════════════════════════════\n');

    const predictor = new AviatorPredictor({ maxHistory: 100 });

    console.log('📊 Alimentando o sistema com dados históricos...\n');

    // Alimenta o predictor com dados históricos
    for (let i = 0; i < simulatedData.length; i++) {
        const value = simulatedData[i];
        predictor.addObservation(value);
        
        // Mostra progresso
        const progress = ((i + 1) / simulatedData.length * 100).toFixed(0);
        process.stdout.write(`\r  Progresso: ${progress}% (${i + 1}/${simulatedData.length})`);
        
        // Small delay for effect
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n');

    // Mostra estatísticas básicas
    const mean = simulatedData.reduce((a, b) => a + b, 0) / simulatedData.length;
    const max = Math.max(...simulatedData);
    const min = Math.min(...simulatedData);
    
    console.log('📈 ESTATÍSTICAS DO HISTÓRICO:');
    console.log(`   Média: ${mean.toFixed(2)}x`);
    console.log(`   Máximo: ${max.toFixed(2)}x`);
    console.log(`   Mínimo: ${min.toFixed(2)}x`);
    console.log(`   Total de observações: ${simulatedData.length}\n`);

    // Faz previsão
    console.log('🔮 FAZENDO PREVISÃO...\n');
    const prediction = predictor.predict();

    console.log('┌─────────────────────────────────────────────┐');
    console.log('│          RESULTADO DA PREVISÃO              │');
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  Previsão: ${prediction.predicted ? prediction.predicted.toFixed(2) + 'x' : 'N/A'.padEnd(11)}                      │`);
    console.log(`│  Confiança: ${(prediction.confidence * 100).toFixed(1)}%                          │`);
    console.log(`│  Recomendação: ${(prediction.recommendation || '').padEnd(21)}│`);
    console.log(`│                                             │`);
    console.log(`│  ${prediction.reason.padEnd(43)}│`);
    console.log('└─────────────────────────────────────────────┘\n');

    // Mostra métodos individuais
    console.log('🧠 MÉTODOS DE PREVISÃO INDIVIDUAIS:\n');
    console.log('  Método                   | Previsão | Confiança');
    console.log('  ─────────────────────────|──────────|──────────');
    
    // Re-executa os métodos para mostrar
    const values = simulatedData;
    const methods = {
        'Médias Móveis': predictor.predictMovingAverage(values),
        'ARIMA': predictor.predictARIMA(values),
        'Análise de Tendência': predictor.predictTrend(values),
        'Distribuição': predictor.predictDistribution(values),
        'Pattern Matching': predictor.predictPattern(values)
    };

    for (const [name, result] of Object.entries(methods)) {
        const valueStr = result.value ? result.value.toFixed(2) + 'x' : 'N/A';
        const confStr = (result.confidence * 100).toFixed(1) + '%';
        console.log(`  ${name.padEnd(24)} | ${valueStr.padEnd(8)} | ${confStr}`);
    }

    console.log('\n');

    // Simula avaliação de previsões
    console.log('📝 AVALIANDO PREVISÕES ANTERIORES...\n');

    // Avalia as últimas 5 observações como se fossem previsões
    for (let i = simulatedData.length - 5; i < simulatedData.length; i++) {
        const actual = simulatedData[i];
        const accuracy = predictor.evaluatePrediction(actual);
        console.log(`  Real: ${actual.toFixed(2)}x | Acurácia: ${(accuracy * 100).toFixed(1)}%`);
    }

    // Mostra estatísticas de acurácia
    const accuracyStats = predictor.getAccuracyStats();
    console.log('\n📊 ESTATÍSTICAS DE ACURÁCIA:');
    console.log(`   Acurácia Média: ${(accuracyStats.averageAccuracy * 100).toFixed(1)}%`);
    console.log(`   Total de Previsões: ${accuracyStats.totalPredictions}`);
    console.log(`   Tendência: ${accuracyStats.trend}\n`);

    console.log('═══════════════════════════════════════════');
    console.log('  ⚠️  LEMBRE: Nenhum sistema prevê 100%!');
    console.log('  Use com responsabilidade.');
    console.log('═══════════════════════════════════════════\n');
}

runDemo().catch(console.error);
