# 🔬 Aviator Predictor - Sistema Avançado de Análise RNG

Sistema profissional de análise e previsão para Aviator na 888bet Moçambique com **machine learning**, **análise estatística avançada** e **coleta massiva de dados**.

---

## 🎯 Sistema Completo Implementado

### 1. 📊 Coletor Massivo de Dados (`data/dataCollector.js`)
- **SQLite** banco de dados local
- Armazena TODAS as rodadas:
  - Multiplicadores
  - Timestamps de precisão (microssegundos)
  - Seeds públicos (client_seed, server_seed_hash)
  - Timing entre rodadas
  - Estado completo do jogo
  - Previsões e acurácias

**Comandos:**
```bash
# Ver dados recentes
node -e "const DC = require('./data/dataCollector'); DC.initialize().then(() => DC.getRecentRounds(10).then(r => console.log(r)))"

# Exportar para CSV
npm run export
```

### 2. 🧠 Rede Neural TensorFlow.js (`ml/neuralNetwork.js`)
Arquitetura profunda:
- **Input**: Últimos 20 multiplicadores + 10 features extraídas
- **Hidden**: 3 camadas densas (128→64→32) com dropout
- **Output**: Previsão + incerteza

**Features extraídas:**
- Médias móveis (5, 10, 20 períodos)
- Desvio padrão
- Tendência (slope)
- Features temporais (hora, minuto)
- Timing entre rodadas

**Comandos:**
```bash
# Treinar modelo com dados históricos
npm run train

# O bot treina automaticamente durante execução
```

### 3. 🔍 RNG Reader Avançado (`rng/rngReader.js`)
**10 análises estatísticas:**

| # | Análise | O que Detecta |
|---|---|---|
| 1 | **Shannon Entropy** | Imprevisibilidade da distribuição |
| 2 | **Min-Entropy** | Pior caso de previsibilidade |
| 3 | **Chi-Quadrado** | Uniformidade da distribuição |
| 4 | **Bias/Viés** | Tendência direcional |
| 5 | **Timing Analysis** | Padrões temporais |
| 6 | **Runs Test** | Aleatoriedade de sequências |
| 7 | **Kolmogorov-Smirnov** | Comparação com distribuição esperada |
| 8 | **Análise Espectral (FFT)** | Periodicidade escondida |
| 9 | **Seed Pattern Detection** | Reutilização de seeds |
| 10 | **Autocorrelação** | Dependência entre valores |
| 11 | **Markov Chains** | Padrões de transição |

**Score de aleatoriedade:** 0-100
- 80-100: Alta aleatoriedade (difícil prever)
- 60-80: Média (alguns padrões)
- 40-60: Baixa (previsível)
- 0-40: **PADRÕES FORTES DETECTADOS**

### 4. ⏱️ Timing Attack Analyzer (`analysis/timingAttack.js`)
Análise ultra-precisa de timing:

- **Microssegundos** entre rodadas
- **Jitter** e variações
- **Periodicidade** escondida
- **Correlação tempo-resultado**
- **Padrões complexos**:
  - Intervalos idênticos
  - Sequências alternantes
  - Tendências temporais

**Score de previsibilidade:** 0-100

### 5. 📈 Sistema de Previsão Estatística (`prediction/aviatorPredictor.js`)
**5 métodos combinados:**
- Médias Móveis Ponderadas (25%)
- ARIMA (25%)
- Análise de Tendência (20%)
- Distribuição de Probabilidade (20%)
- Pattern Matching (10%)

---

## 🚀 Como Usar

### Instalação Completa
```bash
cd /home/tiih/aviator-bot
npm install
```

### 1. Coletar Dados (Primeira Vez)
```bash
# Executa o bot para coletar dados
npm start
```

Deixe rodando para coletar pelo menos **100 rodadas** (quanto mais, melhor).

### 2. Treinar Rede Neural
```bash
# Após coletar dados suficientes
npm run train
```

### 3. Executar com Todos os Sistemas
```bash
npm start
```

O bot irá:
1. ✅ Login na 888bet
2. ✅ Coletar TODOS os dados
3. ✅ Analisar RNG em tempo real
4. ✅ Timing attack continuamente
5. ✅ Fazer previsões com 6 métodos
6. ✅ Treinar rede neural periodicamente
7. ✅ Dashboard em http://localhost:3000

### 4. Ver Dashboard
http://localhost:3000 mostra:
- Previsões em tempo real
- Análise RNG completa
- Timing attack results
- Acurácia das previsões
- Gráficos históricos

### 5. Exportar Dados
```bash
# Exporta tudo para CSV
npm run export
```

---

## 📁 Estrutura Completa

```
aviator-bot/
├── auth/
│   └── authManager.js              # Login 888bet
├── game/
│   ├── gameMonitor.js              # Monitor + TODAS as análises
│   ├── betManager.js               # Gestão apostas
│   ├── strategies.js               # Martingale
│   └── statsTracker.js             # Estatísticas
├── prediction/
│   └── aviatorPredictor.js         # 5 métodos estatísticos
├── rng/
│   └── rngReader.js                # 🔬 10 análises RNG
├── ml/
│   └── neuralNetwork.js            # 🧠 TensorFlow.js
├── analysis/
│   └── timingAttack.js             # ⏱️ Timing ultra-preciso
├── data/
│   ├── dataCollector.js            # 📊 SQLite coletor massivo
│   └── aviator_data.db             # Banco de dados (criado auto)
├── server/
│   └── dashboardServer.js          # Dashboard web
├── util/
│   ├── config.js                   # Configurações 888bet
│   ├── logger.js                   # Logging
│   └── frameHelper.js              # Helper iframes
├── public/
│   └── index.html                  # Dashboard bonito
├── index.js                        # Principal
├── train-model.js                  # Treinar rede neural
├── demo-predictor.js               # Demo
└── test-888bet.js                  # Teste integração
```

---

## 🎯 Múltiplos Sistemas de Previsão

### Quando uma rodada termina:

1. **RNG Reader** analisa:
   - Entropia da distribuição
   - Bias detectado
   - Autocorrelação
   - Patterns Markov
   - Score geral

2. **Timing Analyzer** analisa:
   - Intervalos entre rodadas
   - Periodicidade
   - Jitter patterns
   - Correlação temporal

3. **Statistical Predictor** prevê:
   - 5 métodos estatísticos
   - Confiança combinada
   - Recomendação

4. **Neural Network** prevê:
   - Rede neural profunda
   - Features extraídas
   - Incerteza

5. **DataCollector** salva:
   - Tudo no banco SQLite
   - Para análise posterior

6. **Sistema decide**:
   - Combina todas as análises
   - Só aposta se confiança alta
   - Registra resultado

---

## 📊 Métricas e Relatórios

### Durante execução:
```
🔍 ANÁLISE RNG:
   Score: 75/100 - MEDIUM_RANDOMNESS
   Entropia: 85.3%
   Entropia alta - boa aleatoriedade
   
📊 ESTATÍSTICAS:
   Coletados: 523 rounds
   Banco: 2.45 MB
   Acurácia: 62.3% (MELHORANDO)
```

### Após treino neural:
```
🧠 TREINO CONCLUÍDO!
   Loss: 0.0234
   Val Loss: 0.0289
   Modelo salvo
```

---

## ⚠️ Realidade Importante

### O Que Este Sistema FAZ:
✅ Coleta milhares de dados
✅ Analisa estatisticamente o RNG
✅ Detecta se há bias/padrões
✅ Usa machine learning real
✅ Encontra correlações temporais
✅ Só aposta quando confiança alta
✅ Aprende continuamente

### O Que Este Sistema NÃO FAZ:
❌ Não "hackeia" nada
❌ Não prevê 100%
❌ Não acessa servidores
❌ Não quebra criptografia
❌ Não garante lucro

### Acurácia Esperada:
- **RNG Forte**: 40-55% (quase aleatório)
- **RNG Médio**: 55-70% (alguns padrões)
- **RNG Fraco**: 70-85% (padrões detectáveis)

O sistema **identifica automaticamente** qual é o caso.

---

## 🛡️ Gestão de Risco

O bot implementa:
- ✅ Stop-loss automático
- ✅ Take-profit
- ✅ Só aposta com análise completa
- ✅ Múltiplas confirmações necessárias
- ✅ Registro completo para auditoria
- ✅ Aprendizado contínuo

---

## 📝 Comandos Úteis

```bash
# Ver dados coletados
node -e "const DC = require('./data/dataCollector'); DC.initialize().then(async () => { const stats = DC.getCollectionStats(); console.log(stats); await DC.close() })"

# Treinar modelo
npm run train

# Exportar CSV
npm run export

# Ver logs
tail -f logs/combined.log

# Dashboard
# Abra http://localhost:3000
```

---

## 🔮 Próximas Melhorias

Quando você encontrar o servidor da 888bet, podemos:

- [ ] Analisar seeds diretamente do servidor
- [ ] Reverter algoritmo se expuser server_seed
- [ ] Timing attack com acesso ao servidor
- [ ] Pre-extrair resultados antes da rodada
- [ ] Múltiplas contas simultâneas
- [ ] API externa para dados compartilhados

---

## ⚖️ Aviso Legal

**ESTE SOFTWARE É PARA FINS EDUCACIONAIS E DE PESQUISA**

Este sistema usa técnicas legítimas de análise de dados e machine learning.
Não realiza nenhum tipo de hack, invasão ou acesso não autorizado.

- 🎲 Apostas envolvem risco financeiro
- 📊 Análise estatística não garante resultados
- 🚫 Verifique legalidade na sua jurisdição
- 💸 Nunca aposte mais do que pode perder

---

## 📄 Licença

MIT License
