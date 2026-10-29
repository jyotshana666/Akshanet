from schema import AdmissionRecord
from features import extract_features


def _make_record(**overrides) -> AdmissionRecord:
    defaults = {
        "admission_id": "adm-1",
        "apaar_id": "123456789012",
        "institution_id": "inst-1",
        "academic_year": "2025-26",
        "seat_type": "GENERAL",
        "admission_date": "2025-06-15T10:00:00Z",
        "programme": "BTECH-CSE",
        "device_fingerprint": "fp-abc",
        "address_hash": "addr-hash-1",
        "batch_submission_time": "2025-06-15T09:00:00Z",
    }
    defaults.update(overrides)
    return AdmissionRecord(**defaults)


def test_clean_record_features():
    records = [_make_record()]
    df = extract_features(records)
    assert len(df) == 1
    row = df.iloc[0]
    assert row["same_device_count"] == 1
    assert row["same_address_count"] == 1
    assert row["apaar_format_valid"] == 1
    assert row["missing_fields_count"] == 0
    assert row["time_since_batch_start_minutes"] >= 0


def test_same_device_count():
    records = [
        _make_record(admission_id="a1", device_fingerprint="same-fp"),
        _make_record(admission_id="a2", device_fingerprint="same-fp"),
        _make_record(admission_id="a3", device_fingerprint="other-fp"),
    ]
    df = extract_features(records)
    assert df.iloc[0]["same_device_count"] == 2
    assert df.iloc[1]["same_device_count"] == 2
    assert df.iloc[2]["same_device_count"] == 1


def test_anomaly_patterns():
    records = [
        _make_record(
            device_fingerprint="same",
            address_hash="same",
            apaar_id="invalid",
            seat_type=None,
        )
        for _ in range(15)
    ]
    df = extract_features(records)
    row = df.iloc[0]
    assert row["same_device_count"] == 15
    assert row["same_address_count"] == 15
    assert row["apaar_format_valid"] == 0
    assert row["missing_fields_count"] >= 1


def test_empty_batch():
    df = extract_features([])
    assert len(df) == 0


def test_missing_optional_fields():
    records = [_make_record(
        device_fingerprint=None,
        address_hash=None,
        seat_type=None,
    )]
    df = extract_features(records)
    assert df.iloc[0]["missing_fields_count"] == 3
    assert df.iloc[0]["same_device_count"] == 0
    assert df.iloc[0]["same_address_count"] == 0
