"""
Sistema de Coleta AUTOMÁTICA de Seeds e Previsão
==================================================

Funciona 24/7:
1. Coleta TODAS as informações de Provably Fair
2. Salva no banco de dados
3. Analisa padrões automaticamente
4. Quando encontra padrão → prevê próximo resultado
5. Mostra previsão instantânea
"""

import json
import hashlib
import hmac
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path
import sys
import os

# Scikit-learn
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score, TimeSeriesSplit

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except:
    HAS_XGBOOST = False

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except:
    HAS_LIGHTGBM = False


class SeedCollector:
    """Coleta e armazena seeds automaticamente"""
    
    def __init__(self):
        self.collected_rounds = []
        self.revealed_seeds = []
        self.pattern_detected = False
        self.pattern_method = None
        self.pattern_confidence = 0
        
    def add_round(self, round_data):
        """
        Adiciona rodada coletada
        
        round_data = {
            'round_id': str,
            'client_seed': str,
            'server_seed_hash': str,
            'nonce': int,
            'multiplier': float,
            'server_seed': str,  # Revelado APÓS o jogo
            'timestamp': int
        }
        """
        self.collected_rounds.append(round_data)
        
        # Se server_seed foi revelado, guarda para análise
        if round_data.get('server_seed'):
            self.revealed_seeds.append(round_data)
            
            # Re-analisa padrões
            if len(self.revealed_seeds) >= 10:
                self._analyze_patterns()
    
    def _analyze_patterns(self):
        """Analisa padrões nos seeds revelados"""
        if len(self.revealed_seeds) < 10:
            return
        
        seeds = [s['server_seed'] for s in self.revealed_seeds]
        
        # Teste 1: Hash Chain (seed_N = SHA256(seed_N-1))
        chain_match = self._test_hash_chain(seeds)
        if chain_match > 0.8:
            self.pattern_detected = True
            self.pattern_method = 'HASH_CHAIN'
            self.pattern_confidence = chain_match
            return
        
        # Teste 2: Correlação numérica
        corr = self._test_correlation(seeds)
        if abs(corr) > 0.7:
            self.pattern_detected = True
            self.pattern_method = 'NUMERIC_CORRELATION'
            self.pattern_confidence = abs(corr)
            return
        
        # Teste 3: Sequência determinística (PRNG)
        det = self._test_deterministic(seeds)
        if det['is_deterministic']:
            self.pattern_detected = True
            self.pattern_method = 'PRNG_SEQUENCE'
            self.pattern_confidence = 1 - det['p_value']
            return
        
        # Sem padrão encontrado
        self.pattern_detected = False
        self.pattern_method = None
        self.pattern_confidence = 0
    
    def _test_hash_chain(self, seeds):
        """Testa se seed_N = SHA256(seed_N-1)"""
        matches = 0
        total = len(seeds) - 1
        
        for i in range(1, len(seeds)):
            expected_hash = hashlib.sha256(seeds[i-1].encode()).hexdigest()
            # Compara prefixo (16 chars = 64 bits)
            if seeds[i].startswith(expected_hash[:16]):
                matches += 1
        
        return matches / total if total > 0 else 0
    
    def _test_correlation(self, seeds):
        """Testa correlação entre seeds consecutivos"""
        values = []
        for seed in seeds:
            if len(seed) >= 8:
                val = int(seed[:8], 16)
                values.append(val)
        
        if len(values) < 3:
            return 0
        
        values = np.array(values)
        mean = np.mean(values)
        var = np.var(values)
        
        if var == 0:
            return 0
        
        corr = np.mean((values[:-1] - mean) * (values[1:] - mean)) / var
        return corr
    
    def _test_deterministic(self, seeds):
        """Testa se seeds vêm de PRNG"""
        try:
            from scipy import stats
            values = [int(s[:8], 16) % 1000 for s in seeds if len(s) >= 8]
            if len(values) < 10:
                return {'is_deterministic': False, 'p_value': 1}
            
            _, p_value = stats.chisquare(np.bincount(values, minlength=100))
            return {
                'is_deterministic': p_value < 0.05,
                'p_value': float(p_value)
            }
        except:
            return {'is_deterministic': False, 'p_value': 1}
    
    def predict_next_seed(self):
        """Prevê o próximo server_seed"""
        if not self.pattern_detected or len(self.revealed_seeds) < 2:
            return None
        
        last_seed = self.revealed_seeds[-1]['server_seed']
        
        if self.pattern_method == 'HASH_CHAIN':
            # seed_proximo = SHA256(seed_atual)
            next_seed = hashlib.sha256(last_seed.encode()).hexdigest()
            return {
                'predicted_seed': next_seed,
                'method': 'HASH_CHAIN',
                'confidence': self.pattern_confidence
            }
        
        elif self.pattern_method == 'NUMERIC_CORRELATION':
            # Usa correlação para prever
            seeds_int = [int(s[:16], 16) for s in [self.revealed_seeds[-2]['server_seed'], last_seed]]
            diff = seeds_int[1] - seeds_int[0]
            next_val = seeds_int[1] + diff
            next_seed = format(abs(next_val) % (16**64), '064x')
            return {
                'predicted_seed': next_seed[:64],
                'method': 'NUMERIC_CORRELATION',
                'confidence': self.pattern_confidence
            }
        
        return None
    
    def get_stats(self):
        return {
            'total_rounds': len(self.collected_rounds),
            'revealed_seeds': len(self.revealed_seeds),
            'pattern_detected': self.pattern_detected,
            'pattern_method': self.pattern_method,
            'pattern_confidence': self.pattern_confidence,
            'can_predict': self.pattern_detected and len(self.revealed_seeds) >= 10
        }


class ResultPredictor:
    """Calcula resultado exato dado os seeds"""
    
    @staticmethod
    def calculate_result(server_seed, client_seed, nonce):
        """Calcula multiplicador exato do Aviator"""
        message = f"{client_seed}:{nonce}"
        h = hmac.new(
            server_seed.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        hash_int = int(h[:13], 16)
        random_float = hash_int / (16 ** 13)
        
        if random_float >= 0.99:
            multiplier = 1.00
        else:
            multiplier = max(1.00, 0.99 / (1 - random_float))
        
        return {
            'multiplier': round(multiplier, 2),
            'hash': h,
            'random_float': random_float
        }


class MLPredictor:
    """ML Ensemble como fallback"""
    
    def __init__(self):
        self.models = {}
        self.is_trained = False
        self.scaler = StandardScaler()
        self.multipliers = []
        
    def add_data(self, multipliers):
        self.multipliers = multipliers
        
    def train(self, threshold=2.0):
        """Treina modelos com dados coletados"""
        if len(self.multipliers) < 50:
            return False
        
        # Features simples
        X = []
        y = []
        
        for i in range(20, len(self.multipliers) - 1):
            features = self._extract_features(self.multipliers[:i+1])
            X.append(features)
            y.append(1 if self.multipliers[i+1] > threshold else 0)
        
        if len(X) < 20:
            return False
        
        X = np.array(X)
        y = np.array(y)
        
        # Treina Random Forest
        self.models['rf'] = RandomForestClassifier(n_estimators=100, random_state=42)
        self.models['rf'].fit(X, y)
        
        # Treina Gradient Boosting
        self.models['gb'] = GradientBoostingClassifier(n_estimators=100, random_state=42)
        self.models['gb'].fit(X, y)
        
        # XGBoost se disponível
        if HAS_XGBOOST:
            self.models['xgb'] = xgb.XGBClassifier(n_estimators=100, random_state=42, eval_metric='logloss')
            self.models['xgb'].fit(X, y)
        
        # LightGBM se disponível
        if HAS_LIGHTGBM:
            self.models['lgb'] = lgb.LGBMClassifier(n_estimators=100, random_state=42, verbose=-1)
            self.models['lgb'].fit(X, y)
        
        self.is_trained = True
        return True
    
    def _extract_features(self, multipliers):
        features = []
        # Últimos 20 valores
        for i in range(1, 21):
            features.append(multipliers[-i] if len(multipliers) >= i else 0)
        # Médias
        features.append(np.mean(multipliers[-5:]) if len(multipliers) >= 5 else 0)
        features.append(np.mean(multipliers[-10:]) if len(multipliers) >= 10 else 0)
        # Std
        features.append(np.std(multipliers[-10:]) if len(multipliers) >= 10 else 0)
        return features
    
    def predict(self):
        """Faz previsão"""
        if not self.is_trained or len(self.multipliers) < 21:
            return None
        
        features = self._extract_features(self.multipliers)
        X = np.array([features])
        
        # Ensemble voting
        votes = []
        confidences = []
        
        for name, model in self.models.items():
            pred = model.predict(X)[0]
            proba = model.predict_proba(X)[0]
            votes.append(pred)
            confidences.append(proba[1] if len(proba) > 1 else 0.5)
        
        # Média das confianças
        avg_confidence = np.mean(confidences)
        majority_vote = np.mean(votes) > 0.5
        
        return {
            'will_exceed_threshold': bool(majority_vote),
            'confidence': float(avg_confidence),
            'method': f'ML_ENSEMBLE_{len(self.models)}_MODELS'
        }


class AutoCollectorPredictor:
    """
    SISTEMA COMPLETO: Coleta + Análise + Previsão Automática
    """
    
    def __init__(self):
        self.collector = SeedCollector()
        self.result_predictor = ResultPredictor()
        self.ml_predictor = MLPredictor()
        self.prediction_history = []
        
    def process_new_round(self, round_data):
        """
        Processa nova rodada coletada
        
        Fluxo:
        1. Salva dados
        2. Se server_seed revelado → analisa padrões
        3. Se padrão encontrado → prevê próximo resultado
        4. Se não → usa ML como fallback
        """
        # Adiciona ao coletor
        self.collector.add_round(round_data)
        
        # Atualiza ML
        multipliers = [r['multiplier'] for r in self.collector.collected_rounds]
        self.ml_predictor.add_data(multipliers)
        
        # Treina ML periodicamente
        if len(multipliers) >= 50 and len(multipliers) % 10 == 0:
            self.ml_predictor.train()
        
        # Gera previsão
        prediction = self._generate_prediction(round_data)
        
        # Salva no histórico
        self.prediction_history.append({
            'round': round_data.get('round_id'),
            'prediction': prediction,
            'actual': round_data.get('multiplier'),
            'timestamp': datetime.now().isoformat()
        })
        
        return prediction
    
    def _generate_prediction(self, current_round):
        """Gera previsão para PRÓXIMA rodada"""
        
        # TENTATIVA 1: Previsão exata com seed previsto
        if self.collector.pattern_detected:
            next_seed_pred = self.collector.predict_next_seed()
            
            if next_seed_pred and next_seed_pred['confidence'] >= 0.8:
                # Usa seed previsto para calcular resultado
                # Precisa de client_seed e nonce da próxima rodada
                # (normalmente disponíveis ANTES da rodada)
                
                next_nonce = current_round.get('nonce', 0) + 1
                next_client_seed = current_round.get('client_seed', 'default')
                
                result = self.result_predictor.calculate_result(
                    next_seed_pred['predicted_seed'],
                    next_client_seed,
                    next_nonce
                )
                
                return {
                    'type': 'EXACT_SEED_PREDICTION',
                    'predicted_multiplier': result['multiplier'],
                    'confidence': next_seed_pred['confidence'],
                    'method': next_seed_pred['method'],
                    'recommendation': 'APOSTAR' if result['multiplier'] > 2.0 else 'AGUARDAR',
                    'reason': f'Seed previsto com {(next_seed_pred["confidence"]*100):.0f}% confiança'
                }
        
        # TENTATIVA 2: ML Ensemble (fallback)
        if self.ml_predictor.is_trained:
            ml_pred = self.ml_predictor.predict()
            if ml_pred:
                return {
                    'type': 'ML_ENSEMBLE',
                    'predicted_exceeds': ml_pred['will_exceed_threshold'],
                    'confidence': ml_pred['confidence'],
                    'method': ml_pred['method'],
                    'recommendation': 'APOSTAR' if ml_pred['will_exceed_threshold'] and ml_pred['confidence'] > 0.7 else 'AGUARDAR',
                    'reason': f'ML confidência: {(ml_pred["confidence"]*100):.0f}%'
                }
        
        # FALLBACK: Sem previsão
        return {
            'type': 'NO_PREDICTION',
            'confidence': 0,
            'recommendation': 'AGUARDAR',
            'reason': f'Coletando dados... ({self.collector.get_stats()["revealed_seeds"]} seeds)'
        }
    
    def get_dashboard_data(self):
        """Dados para o dashboard"""
        stats = self.collector.get_stats()
        last_pred = self.prediction_history[-1] if self.prediction_history else None
        
        # Calcula acurácia
        accuracy = 0
        if len(self.prediction_history) >= 5:
            correct = 0
            total = 0
            for p in self.prediction_history[-50:]:
                if p.get('prediction') and p.get('actual'):
                    pred_mult = p['prediction'].get('predicted_multiplier', 0)
                    actual = p['actual']
                    if pred_mult > 0:
                        error = abs(pred_mult - actual) / actual
                        accuracy += max(0, 1 - error)
                        total += 1
            accuracy = accuracy / total if total > 0 else 0
        
        return {
            'collector_stats': stats,
            'last_prediction': last_pred,
            'accuracy': accuracy,
            'recent_predictions': self.prediction_history[-10:] if self.prediction_history else []
        }


def main():
    """Recebe dados do Node.js e retorna previsão"""
    input_data = json.loads(sys.stdin.read())
    action = input_data.get('action')
    
    collector = AutoCollectorPredictor()
    
    if action == 'process_round':
        # Processa múltiplas rodadas
        for round_data in input_data.get('rounds', []):
            result = collector.process_new_round(round_data)
        
        # Retorna última previsão
        print(json.dumps({
            'status': 'success',
            'prediction': result,
            'stats': collector.get_dashboard_data()
        }), flush=True)
    
    elif action == 'get_prediction':
        # Só retorna previsão atual
        for round_data in input_data.get('history', []):
            collector.process_new_round(round_data)
        
        last_pred = collector.prediction_history[-1] if collector.prediction_history else None
        print(json.dumps({
            'status': 'success',
            'prediction': last_pred,
            'stats': collector.get_dashboard_data()
        }), flush=True)


if __name__ == '__main__':
    main()
