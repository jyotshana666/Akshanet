"""Standalone training script. Run: python train.py"""
import numpy as np
import pandas as pd
import joblib
from model import train, FEATURE_COLUMNS, MODEL_PATH


def main():
    print("Training IsolationForest model...")
    iso = train()
    joblib.dump(iso, MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")

    rng = np.random.RandomState(99)
    clean_test = pd.DataFrame({
        "same_device_count": rng.randint(0, 3, 100),
        "same_address_count": rng.randint(0, 3, 100),
        "time_since_batch_start_minutes": rng.uniform(5, 1440, 100),
        "missing_fields_count": rng.randint(0, 2, 100),
        "apaar_format_valid": np.ones(100, dtype=int),
    })
    anomaly_test = pd.DataFrame({
        "same_device_count": rng.randint(10, 25, 20),
        "same_address_count": rng.randint(8, 20, 20),
        "time_since_batch_start_minutes": rng.uniform(0, 1, 20),
        "missing_fields_count": rng.randint(5, 10, 20),
        "apaar_format_valid": rng.choice([0, 1], 20, p=[0.6, 0.4]),
    })

    for df in [clean_test, anomaly_test]:
        for col in FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = 0

    clean_preds = iso.predict(clean_test[FEATURE_COLUMNS])
    anomaly_preds = iso.predict(anomaly_test[FEATURE_COLUMNS])

    clean_acc = (clean_preds == 1).sum() / len(clean_preds)
    anomaly_det = (anomaly_preds == -1).sum() / len(anomaly_preds)

    print(f"\n--- Accuracy Report ---")
    print(f"Clean records correctly classified: {clean_acc:.1%}")
    print(f"Anomalies correctly detected:      {anomaly_det:.1%}")
    print(f"Clean test size:   {len(clean_preds)}")
    print(f"Anomaly test size: {len(anomaly_preds)}")


if __name__ == "__main__":
    main()
