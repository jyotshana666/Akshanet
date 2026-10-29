from fastapi import FastAPI
from contextlib import asynccontextmanager

from schema import ScoreBatchRequest, ScoreBatchResponse, ScoreResult
from features import extract_features
from model import load_model, score


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(title="Akshanet ML Scoring", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": True}


@app.post("/score", response_model=ScoreBatchResponse)
def score_batch(request: ScoreBatchRequest):
    if not request.records:
        return ScoreBatchResponse(results=[])

    features_df = extract_features(request.records)
    raw_results = score(features_df)

    results = []
    for record, scored in zip(request.records, raw_results):
        results.append(ScoreResult(
            admission_id=record.admission_id,
            risk_score=scored["risk_score"],
            flag=scored["flag"],
        ))

    return ScoreBatchResponse(results=results)
