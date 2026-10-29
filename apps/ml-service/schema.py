from pydantic import BaseModel
from typing import Optional


class AdmissionRecord(BaseModel):
    admission_id: str
    apaar_id: str
    institution_id: str
    academic_year: str
    seat_type: Optional[str] = None
    admission_date: str
    programme: str
    device_fingerprint: Optional[str] = None
    address_hash: Optional[str] = None
    batch_submission_time: str


class ScoreResult(BaseModel):
    admission_id: str
    risk_score: float
    flag: str


class ScoreBatchRequest(BaseModel):
    records: list[AdmissionRecord]


class ScoreBatchResponse(BaseModel):
    results: list[ScoreResult]
