# Aviator Predictor Bot - 888bet Moçambique

Bot automatizado para apostas no jogo Aviator na plataforma 888bets.co.mz com **sistema de previsão estatística avançada**.

## 🚀 Como Usar

### Instalação
```bash
cd /home/tiih/aviator-bot
npm install
```

### Executar o Bot com Login
```bash
npm start
```

### Testar Integração com 888bet
```bash
npm test
```

### Demonstração do Sistema de Previsão
```bash
npm run demo
```

## 🤖 Sistema de Previsão

O bot utiliza **5 métodos estatísticos** combinados para prever o próximo multiplicador:

### 1. Médias Móveis Ponderadas (25%)
- Média móvel curta (5 períodos)
- Média móvel longa (10 períodos)
- Média ponderada exponencial (mais recente = mais peso)

### 2. ARIMA (25%)
- AutoRegressive Integrated Moving Average
- Modelo estatístico avançado para séries temporais
- Ordem: AR(3), I(1), MA(2)

### 3. Análise de Tendência (20%)
- Regressão linear para detectar direção
- Calcula slope (inclinação) da tendência
- Identifica se está SUBINDO, DESCENDO ou ESTÁVEL

### 4. Distribuição de Probabilidade (20%)
- Análise estatística completa
- Mediana, moda, média, desvio padrão
- Percentis para avaliação de risco

### 5. Pattern Matching (10%)
- Busca padrões similares no histórico
- Similaridade por cosseno
- Usa top 5 padrões mais similares

## 📊 Dashboard em Tempo Real

O bot inclui um dashboard web que mostra:
- Previsão em tempo real com confiança
- Gráfico de multiplicadores vs previsões
- Acurácia de previsões anteriores
- Estatísticas de apostas (win rate, lucro)
- Detalhes de cada método individual

**Acesse em:** http://localhost:3000

## 🎯 Recomendações do Bot

O sistema gera recomendações baseadas na confiança e consenso dos métodos:

| Recomendação | Significado |
|---|---|
| **APOSTAR_CONSERVADOR** | Previsão ≥ 2.0x com confiança ≥ 60% |
| **APOSTAR_MODERADO** | Previsão ≥ 1.5x com confiança ≥ 70% |
| **AGUARDAR** | Condições não ideais |
| **NÃO_APOSTAR** | Previsão abaixo de 1.5x - risco alto |

## 📁 Estrutura do Projeto

```
aviator-bot/
├── auth/
│   └── authManager.js          # Login/logout na 888bet
├── game/
│   ├── gameMonitor.js          # Monitoramento + previsão
│   ├── betManager.js           # Gestão de apostas
│   ├── strategies.js           # Estratégias (Martingale)
│   └── statsTracker.js         # Estatísticas
├── prediction/
│   └── aviatorPredictor.js     # 🆕 Sistema de previsão
├── server/
│   └── dashboardServer.js      # 🆕 Servidor web dashboard
├── util/
│   ├── config.js               # Configurações 888bet
│   ├── logger.js               # Logging
│   └── frameHelper.js          # Helper iframes
├── database/
│   └── database.js             # MySQL (opcional)
├── public/
│   ├── index.html              # 🆕 Dashboard bonito
│   └── script.js               # Gráficos
├── index.js                    # Principal
├── test-888bet.js              # Teste integração
└── demo-predictor.js           # 🆕 Demo previsão
```

## ⚙️ Estratégias de Apostas

### Conservadora
- Aposta: 1 MT | Alvo: 1.20x
- Stop loss: 20 MT | Take profit: 40 MT

### Moderada
- Aposta: 2 MT | Alvo: 1.50x
- Stop loss: 50 MT | Take profit: 100 MT

### Agressiva
- Aposta: 5 MT | Alvo: 2.00x
- Stop loss: 100 MT | Take profit: 300 MT

## 🔄 Fluxo de Execução

1. **Inicialização** → Inicia dashboard web
2. **Login** → Autentica na 888bets.co.mz
3. **Navegação** → Vai para página do Aviator
4. **Coleta de Dados** → Lê multiplicadores de jogos anteriores
5. **Previsão** → Analisa com 5 métodos estatísticos
6. **Decisão** → Aposta apenas se previsão for confiável
7. **Cashout** → Retira no multiplicador alvo
8. **Avaliação** → Compara previsão com resultado real
9. **Aprendizado** → Melhora precisão com mais dados

## 📈 Acurácia do Sistema

**IMPORTANTE:** Nenhum sistema prevê Aviator com 100% de precisão!

O sistema usa análise estatística real que pode identificar **tendências**, mas:
- Aviator usa RNG (gerador de números aleatórios)
- A acurácia típica é 40-70% dependendo das condições
- O bot só aposta quando a confiança é alta
- Gestão de banca é essencial para longo prazo

## 🛡️ Gestão de Risco

O bot implementa:
- ✅ Stop-loss automático
- ✅ Take-profit para proteger lucros
- ✅ Limite máximo de aposta
- ✅ Sistema Martingale controlado
- ✅ Apenas aposta com alta confiança
- ✅ Registro completo de histórico

## 📝 Logging

Logs salvos em:
- `logs/combined.log` - Todos os eventos
- `logs/error.log` - Erros detalhados

## ⚠️ Aviso Legal

**ESTE SOFTWARE É PARA FINS EDUCACIONAIS E DE PESQUISA**

- 🎲 Apostas envolvem risco financeiro significativo
- 🚫 Uso de bots pode violar termos da plataforma
- 💸 Nunca aposte dinheiro que não pode perder
- ❌ Desenvolvedores não são responsáveis por perdas
- ✅ Use com responsabilidade

## 🎯 Próximas Melhorias

- [ ] Machine Learning com TensorFlow.js
- [ ] Mais fontes de dados (clima, horário, etc)
- [ ] Backtesting com dados históricos
- [ ] Múltiplas contas simultâneas
- [ ] Notificações mobile
- [ ] Exportar relatórios CSV

## 📄 Licença

MIT License
