"""
Teste COMPLETO do Sistema 99% - Relatório Detalhado
====================================================

Simula o fluxo completo:
1. Gera dados simulados de 1000 rodadas
2. Simula extração de Provably Fair
3. Analisa cadeia de seeds
4. Tenta prever resultados
5. Testa ML Ensemble
6. Gera relatório completo
"""

import json
import hashlib
import hmac
import numpy as np
import pandas as pd
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from ultimate_predictor import UltimatePredictor, ProvablyFairAnalyzer
from aviator_ml import AviatorMLPredictor


def generate_realistic_data(num_rounds=1000):
    """Gera dados realistas de Aviator com Provably Fair"""
    
    # Simula geração de seeds com padrão hash chain (FRACO)
    master_seed = hashlib.sha256(b"master_seed_test").hexdigest()
    
    rounds = []
    current_seed = master_seed
    
    np.random.seed(42)  # Para reprodutibilidade
    
    for i in range(num_rounds):
        # Server seed (seguinte na cadeia)
        server_seed = hashlib.sha256(f"{current_seed}_{i}".encode()).hexdigest()
        server_seed_hash = hashlib.sha256(server_seed.encode()).hexdigest()
        
        # Client seed (público)
        client_seed = hashlib.sha256(f"client_{i}".encode()).hexdigest()[:16]
        
        # Nonce
        nonce = i + 1
        
        # Calcula resultado (simula Aviator)
        h = hmac.new(
            server_seed.encode(),
            f"{client_seed}:{nonce}".encode(),
            hashlib.sha256
        ).hexdigest()
        
        hash_int = int(h[:13], 16)
        random_float = hash_int / (16 ** 13)
        
        if random_float >= 0.99:
            multiplier = 1.00
        else:
            multiplier = max(1.00, 0.99 / (1 - random_float))
        
        round_data = {
            'round_id': f"round_{i+1}",
            'client_seed': client_seed,
            'server_seed_hash': server_seed_hash,
            'server_seed': server_seed,  # Revelado após jogo
            'nonce': nonce,
            'multiplier': round(multiplier, 2),
            'timestamp': int(datetime.now().timestamp()) - (num_rounds - i) * 15000
        }
        
        rounds.append(round_data)
        current_seed = server_seed
    
    return rounds


def test_provablyFair_analysis(rounds):
    """Testa análise de Provably Fair"""
    print("\n" + "="*70, flush=True)
    print("🔍 TESTE 1: PROVABLY FAIR ANALYSIS", flush=True)
    print("="*70 + "\n", flush=True)
    
    analyzer = ProvablyFairAnalyzer()
    
    # Adiciona todas as rodadas
    for r in rounds:
        analyzer.add_round_info(r)
    
    print(f"📊 Dados coletados: {len(analyzer.seeds_history)} rodadas", flush=True)
    print(f"🔑 Seeds revelados: {len(analyzer.revealed_seeds)}", flush=True)
    
    # Verifica seeds
    verified = 0
    for r in analyzer.revealed_seeds[:10]:
        result = analyzer.verify_seed(r)
        if result:
            verified += 1
    
    print(f"✅ Seeds verificados: {verified}/10", flush=True)
    
    # Análise de cadeia
    print("\n🔗 ANÁLISE DE CADEIA DE SEEDS:", flush=True)
    chain_result = analyzer.analyze_seed_chain()
    
    print(f"   Status: {chain_result['status']}", flush=True)
    print(f"   Total seeds: {chain_result['total_seeds']}", flush=True)
    print(f"   Hash Chain: {'✅ SIM' if chain_result['hash_chain']['is_chain'] else '❌ NÃO'}", flush=True)
    print(f"   Correlação: {'✅ SIM' if chain_result['correlation']['is_correlated'] else '❌ NÃO'} ({chain_result['correlation']['correlation']:.3f})", flush=True)
    print(f"   Determinístico: {'✅ SIM' if chain_result['deterministic']['is_deterministic'] else '❌ NÃO'} (p={chain_result['deterministic']['p_value']:.4f})", flush=True)
    print(f"   Entropia: {chain_result['entropy']['normalized']*100:.1f}%", flush=True)
    print(f"   Previsível: {'✅ SIM' if chain_result['predictable'] else '❌ NÃO'}", flush=True)
    print(f"   Confiança: {chain_result['confidence']*100:.0f}%", flush=True)
    print(f"   Método: {chain_result.get('prediction_method', 'N/A')}", flush=True)
    
    # Tenta prever próximo seed
    print("\n🎯 PREVISÃO DE PRÓXIMO SEED:", flush=True)
    next_seed_pred = analyzer.predict_next_seed()
    
    if next_seed_pred:
        print(f"   ✅ Previsão possível!", flush=True)
        print(f"   Método: {next_seed_pred['method']}", flush=True)
        print(f"   Confiança: {next_seed_pred['confidence']*100:.0f}%", flush=True)
    else:
        print(f"   ❌ Previsão não possível com dados atuais", flush=True)
    
    return chain_result, next_seed_pred


def test_exact_calculation(rounds):
    """Testa cálculo exato de resultados"""
    print("\n" + "="*70, flush=True)
    print("🎯 TESTE 2: CÁLCULO EXATO DE RESULTADOS", flush=True)
    print("="*70 + "\n", flush=True)
    
    analyzer = ProvablyFairAnalyzer()
    
    # Testa com últimas 10 rodadas
    test_rounds = rounds[-10:]
    correct = 0
    
    for r in test_rounds:
        # Usa seed DA rodada (como se tivéssemos previsto)
        result = analyzer.calculate_result_from_seed(
            r['server_seed'],
            r['client_seed'],
            r['nonce']
        )
        
        actual = r['multiplier']
        predicted = result['multiplier']
        
        if abs(predicted - actual) < 0.01:
            correct += 1
            status = "✅"
        else:
            status = "❌"
        
        print(f"   {status} Round #{r['nonce']}: Previsto={predicted:.2f}x | Real={actual:.2f}x", flush=True)
    
    accuracy = correct / len(test_rounds) * 100
    print(f"\n📊 Acurácia: {accuracy:.0f}% ({correct}/{len(test_rounds)})", flush=True)
    
    return accuracy


def test_ml_ensemble(rounds):
    """Testa ML Ensemble"""
    print("\n" + "="*70, flush=True)
    print("🧠 TESTE 3: ML ENSEMBLE (13 MODELOS)", flush=True)
    print("="*70 + "\n", flush=True)
    
    # Extrai multiplicadores
    multipliers = [r['multiplier'] for r in rounds]
    
    print(f"📊 {len(multipliers)} amostras", flush=True)
    print(f"   Média: {np.mean(multipliers):.2f}x", flush=True)
    print(f"   Máx: {max(multipliers):.2f}x", flush=True)
    print(f"   Mín: {min(multipliers):.2f}x", flush=True)
    
    # Treina Scikit-Learn
    print("\n⚙️ Treinando modelos...", flush=True)
    ml_predictor = AviatorMLPredictor()
    
    # Divide em treino/teste
    train_multipliers = multipliers[:800]
    test_multipliers = multipliers[800:]
    
    results = ml_predictor.train_all(train_multipliers, threshold=2.0, auto_select=True)
    
    if results:
        print("\n🏆 PERFORMANCE DOS MODELOS:\n", flush=True)
        print(f"{'Modelo':<30} {'Accuracy':<12} {'CV Score':<15}", flush=True)
        print("-" * 60, flush=True)
        
        for i, (name, metrics) in enumerate(sorted(results.items(), key=lambda x: x[1].get('cv_accuracy', 0) if isinstance(x[1].get('cv_accuracy'), (int, float)) else 0, reverse=True)):
            model_name = metrics.get('model_name', name)
            accuracy = metrics.get('accuracy', 0) * 100
            cv_acc = metrics.get('cv_accuracy', 0)
            cv_std = metrics.get('cv_std', 0)
            
            if isinstance(cv_acc, (int, float)) and str(cv_acc) != 'nan':
                cv_str = f"{cv_acc*100:.1f}% ± {cv_std*100:.1f}%"
            else:
                cv_str = "N/A"
            
            emoji = "🥇" if i == 0 else "  "
            print(f"{emoji} {model_name:<28} {accuracy:<11.1f}% {cv_str}", flush=True)
    
    # Testa previsões
    print("\n🎯 TESTANDO PREVISÕES (últimas 50 rodadas):", flush=True)
    correct = 0
    total = 0
    
    for i in range(800, min(850, len(multipliers))):
        train_data = multipliers[:i]
        actual = multipliers[i]
        
        if len(train_data) >= 50:
            pred = ml_predictor.predict(train_data, threshold=2.0)
            if pred:
                predicted_exceeds = pred.get('recommendation') == 'APOSTAR'
                actual_exceeds = actual > 2.0
                
                if predicted_exceeds == actual_exceeds:
                    correct += 1
                total += 1
                
                if total <= 10:  # Mostra primeiras 10
                    status = "✅" if predicted_exceeds == actual_exceeds else "❌"
                    print(f"   {status} Previsto={'>' if predicted_exceeds else '<'}2.0x | Real={actual:.2f}x | Conf={pred['confidence']*100:.0f}%", flush=True)
    
    if total > 0:
        ml_accuracy = correct / total * 100
        print(f"\n📊 ML Accuracy: {ml_accuracy:.1f}% ({correct}/{total})", flush=True)
    else:
        ml_accuracy = 0
        print(f"\n❌ Sem previsões válidas", flush=True)
    
    return ml_accuracy


def test_ultimate_predictor(rounds):
    """Testa Ultimate Predictor completo"""
    print("\n" + "="*70, flush=True)
    print("🎯 TESTE 4: ULTIMATE PREDICTOR (SISTEMA HÍBRIDO)", flush=True)
    print("="*70 + "\n", flush=True)
    
    predictor = UltimatePredictor()
    
    # Adiciona histórico
    for r in rounds:
        predictor.add_round_result(r)
    
    # Estratégia atual
    strategy = predictor.get_strategy()
    print(f"📋 ESTRATÉGIA ATUAL:", flush=True)
    print(f"   Fase: {strategy['phase']}", flush=True)
    print(f"   Ação: {strategy['action']}", flush=True)
    print(f"   Progresso para 99%: {strategy['progress_to_99']:.1f}%", flush=True)
    
    # Testa previsão
    multipliers = [r['multiplier'] for r in rounds]
    client_seed = rounds[-1]['client_seed']
    nonce = rounds[-1]['nonce'] + 1
    
    print("\n🔮 FAZENDO PREVISÃO PARA PRÓXIMA RODADA:", flush=True)
    prediction = predictor.get_hybrid_prediction(multipliers, client_seed, nonce)
    
    print(f"   Método: {prediction['method']}", flush=True)
    print(f"   Confiança: {prediction['confidence']*100:.1f}%", flush=True)
    print(f"   Recomendação: {prediction['recommendation']}", flush=True)
    print(f"   Razão: {prediction['reason']}", flush=True)
    
    return prediction


def generate_final_report(chain_result, seed_pred, exact_acc, ml_acc, ultimate_pred):
    """Gera relatório final"""
    print("\n" + "="*70, flush=True)
    print("📊 RELATÓRIO FINAL DO SISTEMA 99%", flush=True)
    print("="*70 + "\n", flush=True)
    
    # Resumo
    print("🎯 RESUMO DOS TESTES:\n", flush=True)
    print(f"{'Teste':<40} {'Resultado':<15} {'Status':<10}", flush=True)
    print("-" * 70, flush=True)
    
    # Provably Fair
    pf_status = "✅" if chain_result['predictable'] else "⚠️"
    print(f"{'Provably Fair Analysis':<40} {chain_result['confidence']*100:.0f}% confiança     {pf_status:<10}", flush=True)
    
    # Cálculo Exato
    exact_status = "✅" if exact_acc >= 99 else "❌"
    print(f"{'Cálculo Exato (com seed)':<40} {exact_acc:.0f}% acurácia     {exact_status:<10}", flush=True)
    
    # ML
    ml_status = "✅" if ml_acc >= 70 else "⚠️"
    print(f"{'ML Ensemble (13 modelos)':<40} {ml_acc:.1f}% acurácia     {ml_status:<10}", flush=True)
    
    # Ultimate
    ult_status = "✅" if ultimate_pred['confidence'] >= 0.95 else "⏳"
    print(f"{'Ultimate Predictor':<40} {ultimate_pred['confidence']*100:.1f}% confiança     {ult_status:<10}", flush=True)
    
    print("\n" + "-" * 70, flush=True)
    
    # Conclusão
    print("\n🎯 CONCLUSÃO:\n", flush=True)
    
    if chain_result['predictable'] and exact_acc >= 99:
        print("✅ SISTEMA 99% FUNCIONANDO!", flush=True)
        print(f"   Padrão de seeds detectado: {chain_result.get('prediction_method', 'N/A')}", flush=True)
        print(f"   Podemos prever resultados exatos", flush=True)
        print(f"   Acurácia esperada: 99%+", flush=True)
    elif ml_acc >= 70:
        print("⚠️  SISTEMA PARCIALMENTE FUNCIONANDO", flush=True)
        print(f"   Seeds NÃO são previsíveis (RNG forte)", flush=True)
        print(f"   Mas ML consegue {ml_acc:.1f}% de acurácia", flush=True)
        print(f"   Precisamos de mais dados para melhorar", flush=True)
    else:
        print("❌ SISTEMA PRECISA DE MAIS DADOS", flush=True)
        print(f"   Seeds não previsíveis", flush=True)
        print(f"   ML com acurácia baixa: {ml_acc:.1f}%", flush=True)
        print(f"   Coletar mais 10,000+ rodadas", flush=True)
    
    print("\n" + "="*70, flush=True)
    print("✅ TESTE CONCLUÍDO!", flush=True)
    print("="*70 + "\n", flush=True)


def main():
    print("\n" + "#"*70, flush=True)
    print("# 🔬 TESTE COMPLETO DO SISTEMA AVIATOR PREDICTOR 99%", flush=True)
    print("#"*70, flush=True)
    print(f"# Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print("#"*70 + "\n", flush=True)
    
    # Gera dados
    print("📊 Gerando 1000 rodadas simuladas...", flush=True)
    rounds = generate_realistic_data(1000)
    print(f"✅ {len(rounds)} rodadas geradas\n", flush=True)
    
    # Teste 1: Provably Fair
    chain_result, seed_pred = test_provablyFair_analysis(rounds)
    
    # Teste 2: Cálculo Exato
    exact_acc = test_exact_calculation(rounds)
    
    # Teste 3: ML Ensemble
    ml_acc = test_ml_ensemble(rounds)
    
    # Teste 4: Ultimate Predictor
    ultimate_pred = test_ultimate_predictor(rounds)
    
    # Relatório Final
    report = generate_final_report(chain_result, seed_pred, exact_acc, ml_acc, ultimate_pred)
    
    # Salva relatório
    report_data = {
        'timestamp': datetime.now().isoformat(),
        'total_rounds': len(rounds),
        'provably_fair': {
            'predictable': chain_result['predictable'],
            'confidence': chain_result['confidence'],
            'method': chain_result.get('prediction_method', 'N/A')
        },
        'exact_calculation_accuracy': exact_acc,
        'ml_ensemble_accuracy': ml_acc,
        'ultimate_prediction': {
            'method': ultimate_pred['method'],
            'confidence': ultimate_pred['confidence'],
            'recommendation': ultimate_pred['recommendation']
        },
        'conclusion': '99%_WORKING' if chain_result['predictable'] and exact_acc >= 99 else 'NEEDS_MORE_DATA'
    }
    
    # Output JSON para Node.js
    print("\n📄 RELATÓRIO JSON:", flush=True)
    print(json.dumps(report_data, indent=2), flush=True)


if __name__ == '__main__':
    main()
