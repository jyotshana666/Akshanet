import pandas as pd
from datetime import datetime
from schema import AdmissionRecord


SEAT_TYPES = [
    "GENERAL", "SC", "ST", "OBC", "EWS", "PH", "MGMT", "NRI", "OTHER"
]


def extract_features(records: list[AdmissionRecord]) -> pd.DataFrame:
    if not records:
        return pd.DataFrame()

    data = []
    device_counts: dict[str, int] = {}
    address_counts: dict[str, int] = {}

    for r in records:
        if r.device_fingerprint:
            device_counts[r.device_fingerprint] = device_counts.get(r.device_fingerprint, 0) + 1
        if r.address_hash:
            address_counts[r.address_hash] = address_counts.get(r.address_hash, 0) + 1

    try:
        earliest = min(
            datetime.fromisoformat(r.batch_submission_time.replace("Z", "+00:00"))
            for r in records
        )
    except (ValueError, TypeError):
        earliest = datetime.now()

    for r in records:
        same_device = device_counts.get(r.device_fingerprint, 0) if r.device_fingerprint else 0
        same_address = address_counts.get(r.address_hash, 0) if r.address_hash else 0

        try:
            admission_dt = datetime.fromisoformat(r.admission_date.replace("Z", "+00:00"))
            time_since = (admission_dt - earliest).total_seconds() / 60.0
        except (ValueError, TypeError):
            time_since = 0.0

        missing = sum(1 for v in [
            r.seat_type, r.device_fingerprint, r.address_hash
        ] if v is None or v == "")

        apaar_valid = 1 if (r.apaar_id.isdigit() and len(r.apaar_id) == 12) else 0

        seat_encoded = [0] * len(SEAT_TYPES)
        st = (r.seat_type or "OTHER").upper()
        if st in SEAT_TYPES:
            seat_encoded[SEAT_TYPES.index(st)] = 1
        else:
            seat_encoded[SEAT_TYPES.index("OTHER")] = 1

        row = {
            "same_device_count": same_device,
            "same_address_count": same_address,
            "time_since_batch_start_minutes": max(time_since, 0.0),
            "missing_fields_count": missing,
            "apaar_format_valid": apaar_valid,
        }
        for i, st_name in enumerate(SEAT_TYPES):
            row[f"seat_{st_name.lower()}"] = seat_encoded[i]

        data.append(row)

    return pd.DataFrame(data)
