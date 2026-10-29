from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_score_valid_batch():
    payload = {
        "records": [
            {
                "admission_id": "adm-1",
                "apaar_id": "123456789012",
                "institution_id": "inst-1",
                "academic_year": "2025-26",
                "seat_type": "GENERAL",
                "admission_date": "2025-06-15T10:00:00Z",
                "programme": "BTECH-CSE",
                "device_fingerprint": "fp-1",
                "address_hash": "addr-1",
                "batch_submission_time": "2025-06-15T09:00:00Z",
            },
            {
                "admission_id": "adm-2",
                "apaar_id": "234567890123",
                "institution_id": "inst-1",
                "academic_year": "2025-26",
                "seat_type": "SC",
                "admission_date": "2025-06-15T11:00:00Z",
                "programme": "BTECH-ECE",
                "device_fingerprint": "fp-2",
                "address_hash": "addr-2",
                "batch_submission_time": "2025-06-15T09:00:00Z",
            },
        ]
    }
    response = client.post("/score", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 2
    for r in data["results"]:
        assert "admission_id" in r
        assert 0.0 <= r["risk_score"] <= 1.0
        assert r["flag"] in ("CLEAN", "ANOMALY_WATCH", "FRAUD_ESCALATION")


def test_score_empty_batch():
    response = client.post("/score", json={"records": []})
    assert response.status_code == 200
    assert response.json()["results"] == []


def test_score_missing_optional_fields():
    payload = {
        "records": [
            {
                "admission_id": "adm-3",
                "apaar_id": "345678901234",
                "institution_id": "inst-2",
                "academic_year": "2025-26",
                "admission_date": "2025-07-01T10:00:00Z",
                "programme": "MBA",
                "batch_submission_time": "2025-07-01T09:00:00Z",
            }
        ]
    }
    response = client.post("/score", json=payload)
    assert response.status_code == 200
    assert len(response.json()["results"]) == 1
