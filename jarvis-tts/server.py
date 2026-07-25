"""JARVIS TTS microservice — wraps Meta's MMS-TTS (Indonesian) for HTTP access."""
import tempfile
from pathlib import Path

import scipy.io.wavfile
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from transformers import AutoTokenizer, VitsModel

app = FastAPI(title="JARVIS TTS Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_ID = "facebook/mms-tts-ind"

# Load once at startup — reused across every /speak request instead of
# reloading the model from disk each time (that would add several seconds
# of latency per request).
print(f"Loading {MODEL_ID} ...")
_model = VitsModel.from_pretrained(MODEL_ID)
_tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
_model.eval()
print("TTS model loaded.")


class SpeakRequest(BaseModel):
    text: str


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "model_loaded": _model is not None,
    }


@app.post("/speak")
async def speak(req: SpeakRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    out_dir = tempfile.mkdtemp(prefix="jarvis-tts-")
    out_path = Path(out_dir) / "output.wav"

    try:
        inputs = _tokenizer(req.text, return_tensors="pt")
        with torch.no_grad():
            output = _model(**inputs).waveform

        scipy.io.wavfile.write(
            str(out_path),
            rate=_model.config.sampling_rate,
            data=output.float().numpy().T,
        )

        if not out_path.exists():
            raise HTTPException(status_code=500, detail="No output file generated")

        return FileResponse(
            path=str(out_path),
            media_type="audio/wav",
            filename="jarvis_speech.wav",
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {exc}") from exc
