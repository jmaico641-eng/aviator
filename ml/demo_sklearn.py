"""
Demonstração Completa do Sistema ML Scikit-Learn
Gera dados simulados e treina TODOS os modelos
"""

import sys
import json

# Dados simulados realistas do Aviator
simulated_data = [
    1.23, 2.45, 1.34, 5.67, 1.89,
    3.12, 1.45, 2.34, 1.12, 4.56,
    1.78, 2.89, 1.56, 3.45, 1.23,
    6.78, 1.34, 2.12, 1.67, 3.89,
    1.45, 2.56, 1.89, 4.23, 1.34,
    2.78, 1.56, 3.12, 1.23, 5.45,
    1.67, 2.34, 1.78, 3.56, 1.45,
    2.12, 1.89, 4.67, 1.34, 2.89,
    1.56, 3.23, 1.78, 2.45, 1.12,
    5.34, 1.67, 2.89, 1.45, 3.78,
    1.23, 2.56, 1.89, 4.12, 1.67,
    3.45, 1.34, 2.78, 1.56, 6.23
]

from aviator_ml import AviatorMLPredictor

print("\n" + "="*70, flush=True)
print("🔬 DEMONSTRAÇÃO COMPLETA - SCIKIT-LEARN AVIATOR PREDICTOR", flush=True)
print("="*70 + "\n", flush=True)

# Cria predictor
predictor = AviatorMLPredictor()

# Treina TODOS os modelos
print(f"📊 Treinando com {len(simulated_data)} amostras...\n", flush=True)

results = predictor.train_all(simulated_data, threshold=2.5)

if results:
    print("\n" + "="*70, flush=True)
    print("📈 RESULTADOS COMPLETOS", flush=True)
    print("="*70 + "\n", flush=True)
    
    # Mostra performance de cada modelo
    print("🏆 PERFORMANCE POR MODELO:\n", flush=True)
    print(f"{'Modelo':<30} {'Accuracy':<12} {'CV Score':<15}", flush=True)
    print("-" * 60, flush=True)
    
    for name, metrics in sorted(results.items(), key=lambda x: x[1].get('cv_accuracy', 0) if not isinstance(x[1].get('cv_accuracy'), str) else 0, reverse=True):
        model_name = metrics.get('model_name', name)
        accuracy = metrics.get('accuracy', 0) * 100
        cv_acc = metrics.get('cv_accuracy', 0)
        cv_std = metrics.get('cv_std', 0)
        
        if isinstance(cv_acc, (int, float)) and not str(cv_acc) == 'nan':
            cv_str = f"{cv_acc*100:.1f}% ± {cv_std*100:.1f}%"
        else:
            cv_str = "N/A"
        
        emoji = "🥇" if list(results.keys()).index(name) == 0 else "  "
        print(f"{emoji} {model_name:<28} {accuracy:<11.1f}% {cv_str}", flush=True)
    
    # Faz previsão
    print("\n" + "="*70, flush=True)
    print("🎯 FAZENDO PREVISÃO", flush=True)
    print("="*70 + "\n", flush=True)
    
    prediction = predictor.predict(simulated_data)
    if prediction:
        print(f"📊 Classificação: {prediction['recommendation']}", flush=True)
        print(f"💪 Confiança: {prediction['confidence']*100:.1f}%", flush=True)
        print(f"🎲 Probabilidade > {prediction['threshold']}x: {prediction['probability_will_exceed']*100:.1f}%", flush=True)
        print(f"🧠 Método: {prediction['method']}", flush=True)
        
        if prediction.get('feature_importance'):
            print(f"\n🔝 Top 5 Features Mais Importantes:\n", flush=True)
            for i, (feat, imp) in enumerate(list(prediction['feature_importance'].items())[:5], 1):
                print(f"   {i}. {feat:<25} {imp*100:.1f}%", flush=True)
    
    # Previsão de valor
    print("\n" + "-"*70, flush=True)
    value_pred = predictor.predict_value(simulated_data)
    if value_pred:
        print(f"\n📊 REGRESSÃO (Valor Exato):", flush=True)
        print(f"   Valor Previsto: {value_pred['predicted_value']:.2f}x", flush=True)
        print(f"   R² Score: {value_pred['r2_score']*100:.1f}%", flush=True)
        print(f"   Método: {value_pred['method']}", flush=True)

print("\n" + "="*70, flush=True)
print("✅ DEMONSTRAÇÃO CONCLUÍDA!", flush=True)
print("="*70 + "\n", flush=True)
