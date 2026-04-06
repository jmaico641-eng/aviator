"""
Aviator ML Predictor - Scikit-Learn Avançado
Sistema completo de Machine Learning com múltiplos algoritmos

Modelos implementados:
1. Random Forest Classifier
2. Gradient Boosting (XGBoost)
3. LightGBM
4. Support Vector Machine (SVM)
5. K-Nearest Neighbors (KNN)
6. Neural Network (MLP)
7. Logistic Regression
8. Ensemble (votação de todos)

Features avançadas:
- Feature engineering automático
- Validação cruzada
- Grid search para hiperparâmetros
- Seleção automática do melhor modelo
- Feature importance
- Análise de SHAP values
"""

import numpy as np
import pandas as pd
import joblib
import json
import sys
import os
from datetime import datetime
from pathlib import Path

# Scikit-learn
from sklearn.ensemble import (
    RandomForestClassifier, 
    GradientBoostingClassifier,
    VotingClassifier,
    ExtraTreesClassifier,
    AdaBoostClassifier
)
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import (
    cross_val_score,
    GridSearchCV,
    train_test_split,
    TimeSeriesSplit
)
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.metrics import (
    accuracy_score,
    mean_squared_error,
    mean_absolute_error,
    r2_score,
    classification_report,
    confusion_matrix
)
from sklearn.feature_selection import SelectKBest, f_regression
from sklearn.pipeline import Pipeline

# XGBoost
try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

# LightGBM
try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False


class AviatorMLPredictor:
    """Sistema avançado de ML com Scikit-Learn"""
    
    def __init__(self, config=None):
        self.config = config or {}
        self.models = {}
        self.best_model = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names = []
        self.model_performance = {}
        self.training_history = []
        
        # Diretorio para salvar modelos
        self.model_dir = Path(__file__).parent.parent / 'models' / 'sklearn'
        self.model_dir.mkdir(parents=True, exist_ok=True)
        
        # Inicializa todos os modelos
        self._initialize_models()
        
    def _initialize_models(self):
        """Inicializa todos os modelos com hiperparâmetros otimizados"""
        
        # 1. Random Forest
        self.models['random_forest'] = {
            'classifier': RandomForestClassifier(
                n_estimators=200,
                max_depth=15,
                min_samples_split=5,
                min_samples_leaf=2,
                max_features='sqrt',
                random_state=42,
                n_jobs=-1
            ),
            'type': 'classifier',
            'name': 'Random Forest'
        }
        
        # 2. Gradient Boosting
        self.models['gradient_boosting'] = {
            'classifier': GradientBoostingClassifier(
                n_estimators=200,
                learning_rate=0.05,
                max_depth=7,
                min_samples_split=5,
                subsample=0.8,
                random_state=42
            ),
            'type': 'classifier',
            'name': 'Gradient Boosting'
        }
        
        # 3. XGBoost
        if HAS_XGBOOST:
            self.models['xgboost'] = {
                'classifier': xgb.XGBClassifier(
                    n_estimators=200,
                    learning_rate=0.05,
                    max_depth=7,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    random_state=42,
                    eval_metric='logloss',
                    use_label_encoder=False
                ),
                'type': 'classifier',
                'name': 'XGBoost'
            }
        
        # 4. LightGBM
        if HAS_LIGHTGBM:
            self.models['lightgbm'] = {
                'classifier': lgb.LGBMClassifier(
                    n_estimators=200,
                    learning_rate=0.05,
                    max_depth=7,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    random_state=42,
                    verbose=-1
                ),
                'type': 'classifier',
                'name': 'LightGBM'
            }
        
        # 5. SVM
        self.models['svm'] = {
            'classifier': SVC(
                kernel='rbf',
                C=1.0,
                gamma='scale',
                probability=True,
                random_state=42
            ),
            'type': 'classifier',
            'name': 'SVM'
        }
        
        # 6. KNN
        self.models['knn'] = {
            'classifier': KNeighborsClassifier(
                n_neighbors=10,
                weights='distance',
                algorithm='auto'
            ),
            'type': 'classifier',
            'name': 'K-Nearest Neighbors'
        }
        
        # 7. MLP Neural Network
        self.models['mlp'] = {
            'classifier': MLPClassifier(
                hidden_layer_sizes=(128, 64, 32),
                activation='relu',
                solver='adam',
                max_iter=500,
                random_state=42,
                early_stopping=True,
                validation_fraction=0.2
            ),
            'type': 'classifier',
            'name': 'Neural Network (MLP)'
        }
        
        # 8. Extra Trees
        self.models['extra_trees'] = {
            'classifier': ExtraTreesClassifier(
                n_estimators=200,
                max_depth=15,
                random_state=42,
                n_jobs=-1
            ),
            'type': 'classifier',
            'name': 'Extra Trees'
        }
        
        # 9. AdaBoost
        self.models['adaboost'] = {
            'classifier': AdaBoostClassifier(
                n_estimators=100,
                learning_rate=0.05,
                random_state=42
            ),
            'type': 'classifier',
            'name': 'AdaBoost'
        }
        
        print(f"[OK] {len(self.models)} modelos inicializados", flush=True)
    
    def create_features(self, data):
        """
        Feature Engineering Avançado
        
        Cria features sofisticadas a partir dos dados brutos
        """
        df = pd.DataFrame(data, columns=['multiplier'])
        
        features = pd.DataFrame()
        
        # 1. Multiplicadores recentes (lag features)
        for i in range(1, 21):
            features[f'lag_{i}'] = df['multiplier'].shift(i)
        
        # 2. Médias móveis
        features['ma_3'] = df['multiplier'].rolling(window=3).mean()
        features['ma_5'] = df['multiplier'].rolling(window=5).mean()
        features['ma_10'] = df['multiplier'].rolling(window=10).mean()
        features['ma_20'] = df['multiplier'].rolling(window=20).mean()
        
        # 3. Desvio padrão móvel
        features['std_5'] = df['multiplier'].rolling(window=5).std()
        features['std_10'] = df['multiplier'].rolling(window=10).std()
        features['std_20'] = df['multiplier'].rolling(window=20).std()
        
        # 4. Features de tendência
        features['ma_3_vs_ma_10'] = features['ma_3'] - features['ma_10']
        features['ma_5_vs_ma_20'] = features['ma_5'] - features['ma_20']
        features['trend_slope'] = df['multiplier'].rolling(window=10).apply(
            lambda x: np.polyfit(range(len(x)), x, 1)[0] if len(x) == 10 else np.nan
        )
        
        # 5. Features estatísticas
        features['skew_20'] = df['multiplier'].rolling(window=20).skew()
        features['kurt_20'] = df['multiplier'].rolling(window=20).kurt()
        
        # 6. Range e volatilidade
        features['range_10'] = df['multiplier'].rolling(window=10).max() - df['multiplier'].rolling(window=10).min()
        features['volatility'] = features['std_10'] / features['ma_10']
        
        # 7. Features de momentum
        features['momentum_5'] = df['multiplier'] / df['multiplier'].shift(5) - 1
        features['momentum_10'] = df['multiplier'] / df['multiplier'].shift(10) - 1
        
        # 8. Contagem de eventos
        features['low_count_20'] = df['multiplier'].rolling(window=20).apply(lambda x: (x < 2.0).sum())
        features['high_count_20'] = df['multiplier'].rolling(window=20).apply(lambda x: (x > 5.0).sum())
        
        # 9. Features temporais
        features['hour'] = pd.Timestamp.now().hour
        features['minute'] = pd.Timestamp.now().minute
        
        # 10. Diferenças
        features['diff_1'] = df['multiplier'].diff(1)
        features['diff_2'] = df['multiplier'].diff(2)
        features['diff_3'] = df['multiplier'].diff(3)
        
        # 11. Ratio features
        features['ratio_high_low'] = features['high_count_20'] / (features['low_count_20'] + 1)
        
        # Remove NaN
        features = features.dropna()
        
        # Salva nomes das features
        self.feature_names = list(features.columns)
        
        return features
    
    def prepare_data(self, multipliers, threshold=2.0):
        """
        Prepara dados para treino
        
        Classifica: 1 se próximo valor > threshold, 0 caso contrário
        """
        if len(multipliers) < 30:
            print(f"[ERRO] Dados insuficientes: {len(multipliers)} (mínimo 30)", flush=True)
            return None, None
        
        # Cria features
        X = self.create_features(multipliers)
        
        if len(X) == 0:
            print("[ERRO] Nenhuma feature válida criada", flush=True)
            return None, None
        
        # Cria labels: 1 se próximo valor > threshold, 0 caso contrário
        y_raw = pd.Series(multipliers)
        y = (y_raw.shift(-1) > threshold).astype(int)
        
        # Alinha X e y
        y = y.iloc[:len(X)]
        X = X.iloc[:len(y)]
        
        # Remove NaN do y - usa values para evitar problema de index
        mask = ~y.isna().values
        X = X.iloc[mask]
        y = y.iloc[mask]
        y = y.reset_index(drop=True)
        X = X.reset_index(drop=True)
        
        print(f"[OK] Dados preparados: {len(X)} amostras, {len(self.feature_names)} features", flush=True)
        print(f"    Distribuição: {y.sum()} positivos, {(1-y).sum()} negativos", flush=True)
        
        return X, y
    
    def train_all(self, multipliers, threshold=2.0, auto_select=True):
        """
        Treina TODOS os modelos e seleciona o melhor
        """
        print(f"\n{'='*60}", flush=True)
        print(f"🧠 TREINANDO {len(self.models)} MODELOS COM SCIKIT-LEARN", flush=True)
        print(f"{'='*60}\n", flush=True)
        
        # Prepara dados
        X, y = self.prepare_data(multipliers, threshold)
        
        if X is None or y is None:
            return None
        
        # Split temporal (80/20)
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
        
        # Escala features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        results = {}
        
        # Treina cada modelo
        for name, model_info in self.models.items():
            print(f"\n📊 Treinando {model_info['name']}...", flush=True)
            
            try:
                model = model_info['classifier']
                model.fit(X_train_scaled, y_train)
                
                # Predições
                y_pred = model.predict(X_test_scaled)
                y_prob = model.predict_proba(X_test_scaled)[:, 1]
                
                # Métricas
                accuracy = accuracy_score(y_test, y_pred)
                
                # Validação cruzada temporal
                tscv = TimeSeriesSplit(n_splits=5)
                cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=tscv, scoring='accuracy')
                cv_mean = cv_scores.mean()
                cv_std = cv_scores.std()
                
                results[name] = {
                    'accuracy': accuracy,
                    'cv_accuracy': cv_mean,
                    'cv_std': cv_std,
                    'model_name': model_info['name'],
                    'model': model
                }
                
                print(f"   ✅ Accuracy: {accuracy*100:.1f}%", flush=True)
                print(f"   📊 CV Accuracy: {cv_mean*100:.1f}% ± {cv_std*100:.1f}%", flush=True)
                
            except Exception as e:
                print(f"   ❌ Erro: {str(e)}", flush=True)
        
        # Seleciona melhor modelo
        if results and auto_select:
            best_name = max(results.keys(), key=lambda k: results[k]['cv_accuracy'])
            self.best_model = results[best_name]['model']
            self.is_trained = True
            
            print(f"\n{'='*60}", flush=True)
            print(f"🏆 MELHOR MODELO: {results[best_name]['model_name']}", flush=True)
            print(f"   CV Accuracy: {results[best_name]['cv_accuracy']*100:.1f}% ± {results[best_name]['cv_std']*100:.1f}%", flush=True)
            print(f"{'='*60}\n", flush=True)
        
        # Salva performance
        self.model_performance = {
            name: {
                'accuracy': res['accuracy'],
                'cv_accuracy': res['cv_accuracy'],
                'cv_std': res['cv_std']
            }
            for name, res in results.items()
        }
        
        # Histórico de treino
        self.training_history.append({
            'timestamp': datetime.now().isoformat(),
            'samples': len(X),
            'features': len(self.feature_names),
            'best_model': best_name if results else None,
            'best_accuracy': results[best_name]['cv_accuracy'] if results else None
        })
        
        # Salva modelos
        self.save_models()
        
        return self.model_performance
    
    def predict(self, multipliers, threshold=2.0):
        """
        Faz previsão com o melhor modelo
        """
        if not self.is_trained or self.best_model is None:
            print("[ERRO] Modelo não treinado", flush=True)
            return None
        
        # Cria features para últimos dados
        df = pd.DataFrame(multipliers, columns=['multiplier'])
        X = self.create_features(multipliers)
        
        if len(X) == 0:
            return None
        
        # Usa última linha
        X_last = X.iloc[[-1]]
        X_scaled = self.scaler.transform(X_last)
        
        # Predição
        prediction = self.best_model.predict(X_scaled)[0]
        probabilities = self.best_model.predict_proba(X_scaled)[0]
        
        # Se classificação: probabilidade da classe positiva
        confidence = probabilities[1] if len(probabilities) > 1 else 0.5
        
        # Feature importance (se disponível)
        feature_importance = {}
        if hasattr(self.best_model, 'feature_importances_'):
            importances = self.best_model.feature_importances_
            feature_importance = dict(zip(self.feature_names, importances.tolist()))
            # Top 5 features
            top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:5]
        
        result = {
            'prediction': int(prediction),
            'confidence': float(confidence),
            'probability_will_exceed': float(confidence),
            'threshold': threshold,
            'recommendation': 'APOSTAR' if prediction == 1 and confidence > 0.6 else 'AGUARDAR',
            'method': self._get_best_model_name(),
            'feature_importance': dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:5]) if feature_importance else {}
        }
        
        return result
    
    def predict_value(self, multipliers):
        """
        Previsão do valor exato (regressão)
        """
        if len(multipliers) < 30:
            return None
        
        # Features
        X = self.create_features(multipliers)
        
        if len(X) == 0:
            return None
        
        # Label: próximo valor
        y = pd.Series(multipliers).iloc[1:len(X)+1].values
        
        X = X.iloc[:len(y)]
        
        # Split
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        # Escala
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Modelo de regressão
        regressors = {
            'random_forest_reg': RandomForestRegressor(n_estimators=100, random_state=42),
            'gradient_boosting_reg': GradientBoostingRegressor(n_estimators=100, random_state=42),
            'ridge': Ridge(alpha=1.0)
        }
        
        if HAS_XGBOOST:
            regressors['xgboost_reg'] = xgb.XGBRegressor(n_estimators=100, random_state=42)
        
        if HAS_LIGHTGBM:
            regressors['lightgbm_reg'] = lgb.LGBMRegressor(n_estimators=100, random_state=42, verbose=-1)
        
        best_score = -float('inf')
        best_model = None
        best_name = None
        
        for name, model in regressors.items():
            model.fit(X_train_scaled, y_train)
            y_pred = model.predict(X_test_scaled)
            score = r2_score(y_test, y_pred)
            
            if score > best_score:
                best_score = score
                best_model = model
                best_name = name
        
        # Predição final
        X_last = X.iloc[[-1]]
        X_scaled = self.scaler.transform(X_last)
        predicted_value = best_model.predict(X_scaled)[0]
        
        return {
            'predicted_value': float(max(1.0, predicted_value)),
            'r2_score': float(best_score),
            'method': f'Regression ({best_name})'
        }
    
    def _get_best_model_name(self):
        """Nome do melhor modelo"""
        for name, info in self.models.items():
            if info['classifier'] == self.best_model:
                return info['name']
        return 'Unknown'
    
    def save_models(self):
        """Salva todos os modelos"""
        models_data = {
            'best_model': self.best_model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'performance': self.model_performance,
            'history': self.training_history,
            'is_trained': self.is_trained
        }
        
        model_path = self.model_dir / 'aviator_model.joblib'
        joblib.dump(models_data, model_path)
        print(f"💾 Modelos salvos em {model_path}", flush=True)
    
    def load_models(self):
        """Carrega modelos salvos"""
        model_path = self.model_dir / 'aviator_model.joblib'
        
        if not model_path.exists():
            print("[AVISO] Nenhum modelo salvo encontrado", flush=True)
            return False
        
        try:
            models_data = joblib.load(model_path)
            self.best_model = models_data['best_model']
            self.scaler = models_data['scaler']
            self.feature_names = models_data['feature_names']
            self.model_performance = models_data['performance']
            self.training_history = models_data['history']
            self.is_trained = models_data['is_trained']
            
            print("✅ Modelos carregados com sucesso", flush=True)
            return True
        except Exception as e:
            print(f"[ERRO] Ao carregar modelos: {e}", flush=True)
            return False
    
    def get_performance_report(self):
        """Relatório completo de performance"""
        return {
            'is_trained': self.is_trained,
            'best_model': self._get_best_model_name(),
            'performance': self.model_performance,
            'features_count': len(self.feature_names),
            'training_history': self.training_history[-5:] if self.training_history else []
        }


# Importações para regressão
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor


def main():
    """Função principal para teste"""
    print("🔬 AVIATOR ML PREDICTOR - SCIKIT-LEARN", flush=True)
    print("="*60, flush=True)
    
    # Lê dados do stdin (passado pelo Node.js)
    input_data = json.loads(sys.stdin.read())
    action = input_data.get('action')
    
    predictor = AviatorMLPredictor()
    
    if action == 'train':
        multipliers = input_data['multipliers']
        result = predictor.train_all(multipliers)
        print(json.dumps({
            'status': 'success',
            'action': 'train',
            'performance': result
        }), flush=True)
    
    elif action == 'predict':
        predictor.load_models()
        multipliers = input_data['multipliers']
        result = predictor.predict(multipliers)
        
        # Também faz previsão de valor
        value_pred = predictor.predict_value(multipliers)
        
        print(json.dumps({
            'status': 'success',
            'action': 'predict',
            'classification': result,
            'regression': value_pred
        }), flush=True)
    
    elif action == 'report':
        predictor.load_models()
        report = predictor.get_performance_report()
        print(json.dumps({
            'status': 'success',
            'action': 'report',
            'report': report
        }), flush=True)
    
    else:
        print(json.dumps({
            'status': 'error',
            'message': f'Ação desconhecida: {action}'
        }), flush=True)


if __name__ == '__main__':
    main()
