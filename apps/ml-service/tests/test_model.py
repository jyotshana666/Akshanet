import pandas as pd
import numpy as np
from model import train, score, FEATURE_COLUMNS


def test_train_returns_model():
    iso = train()
    assert hasattr(iso, "predict")
    assert hasattr(iso, "decision_function")


def test_score_clean_records():
    iso = train()
    import model as m
    m._model = iso

    clean = pd.DataFrame({
        "same_device_count": [1, 0, 2],
        "same_address_count": [1, 0, 1],
        "time_since_batch_start_minutes": [60.0, 120.0, 30.0],
        "missing_fields_count": [0, 1, 0],
        "apaar_format_valid": [1, 1, 1],
    })
    for col in FEATURE_COLUMNS:
        if col not in clean.columns:
            clean[col] = 0

    results = score(clean)
    assert len(results) == 3
    for r in results:
        assert 0.0 <= r["risk_score"] <= 1.0
        assert r["flag"] in ("CLEAN", "ANOMALY_WATCH", "FRAUD_ESCALATION")


def test_score_anomaly_records():
    iso = train()
    import model as m
    m._model = iso

    clean = pd.DataFrame({
        "same_device_count": [0, 1, 0],
        "same_address_count": [0, 0, 1],
        "time_since_batch_start_minutes": [100.0, 200.0, 300.0],
        "missing_fields_count": [0, 0, 1],
        "apaar_format_valid": [1, 1, 1],
    })
    anomaly = pd.DataFrame({
        "same_device_count": [20, 18],
        "same_address_count": [15, 12],
        "time_since_batch_start_minutes": [0.1, 0.2],
        "missing_fields_count": [7, 6],
        "apaar_format_valid": [0, 0],
    })
    mixed = pd.concat([clean, anomaly], ignore_index=True)
    for col in FEATURE_COLUMNS:
        if col not in mixed.columns:
            mixed[col] = 0

    results = score(mixed)
    assert len(results) == 5
    anomaly_scores = [results[i]["risk_score"] for i in range(3, 5)]
    clean_scores = [results[i]["risk_score"] for i in range(3)]
    assert max(anomaly_scores) > min(clean_scores)


def test_flag_assignment():
    iso = train()
    import model as m
    m._model = iso

    mixed = pd.DataFrame({
        "same_device_count": [0, 5, 20],
        "same_address_count": [0, 4, 15],
        "time_since_batch_start_minutes": [100.0, 10.0, 0.1],
        "missing_fields_count": [0, 3, 8],
        "apaar_format_valid": [1, 1, 0],
    })
    for col in FEATURE_COLUMNS:
        if col not in mixed.columns:
            mixed[col] = 0

    results = score(mixed)
    flags = [r["flag"] for r in results]
    assert all(f in ("CLEAN", "ANOMALY_WATCH", "FRAUD_ESCALATION") for f in flags)
