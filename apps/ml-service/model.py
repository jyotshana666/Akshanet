import os
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import IsolationForest


MODEL_PATH = os.getenv("MODEL_PATH", "model.pkl")

_model: IsolationForest | None = None


FEATURE_COLUMNS = [
    "same_device_count",
    "same_address_count",
    "time_since_batch_start_minutes",
    "missing_fields_count",
    "apaar_format_valid",
    "seat_general", "seat_sc", "seat_st", "seat_obc", "seat_ews",
    "seat_ph", "seat_mgmt", "seat_nri", "seat_other",
]


def train() -> IsolationForest:
    rng = np.random.RandomState(42)

    clean = pd.DataFrame({
        "same_device_count": rng.randint(0, 3, 500),
        "same_address_count": rng.randint(0, 3, 500),
        "time_since_batch_start_minutes": rng.uniform(5, 1440, 500),
        "missing_fields_count": rng.randint(0, 2, 500),
        "apaar_format_valid": np.ones(500, dtype=int),
    })

    anomaly = pd.DataFrame({
        "same_device_count": rng.randint(10, 25, 50),
        "same_address_count": rng.randint(8, 20, 50),
        "time_since_batch_start_minutes": rng.uniform(0, 1, 50),
        "missing_fields_count": rng.randint(5, 10, 50),
        "apaar_format_valid": rng.choice([0, 1], 50, p=[0.6, 0.4]),
    })

    for df in [clean, anomaly]:
        for col in FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = 0

    data = pd.concat([clean, anomaly], ignore_index=True)[FEATURE_COLUMNS]

    iso = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
    iso.fit(data)

    return iso


def load_model() -> IsolationForest:
    global _model
    if _model is not None:
        return _model

    if os.path.exists(MODEL_PATH):
        _model = joblib.load(MODEL_PATH)
    else:
        _model = train()
        joblib.dump(_model, MODEL_PATH)

    return _model


def score(features_df: pd.DataFrame) -> list[dict]:
    model = load_model()

    for col in FEATURE_COLUMNS:
        if col not in features_df.columns:
            features_df[col] = 0

    X = features_df[FEATURE_COLUMNS]
    raw_scores = model.decision_function(X)

    min_s, max_s = raw_scores.min(), raw_scores.max()
    if max_s == min_s:
        normalised = np.full_like(raw_scores, 0.5)
    else:
        normalised = 1.0 - (raw_scores - min_s) / (max_s - min_s)

    results = []
    for risk in normalised:
        risk = float(np.clip(risk, 0.0, 1.0))
        if risk > 0.7:
            flag = "FRAUD_ESCALATION"
        elif risk >= 0.4:
            flag = "ANOMALY_WATCH"
        else:
            flag = "CLEAN"
        results.append({"risk_score": round(risk, 4), "flag": flag})

    return results
