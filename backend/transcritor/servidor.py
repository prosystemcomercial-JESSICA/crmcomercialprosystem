"""Transcritor local de áudios do WhatsApp (Whisper, sem custo).

Roda no servidor como pm2 "transcritor", só em 127.0.0.1. O backend manda o áudio
cru (POST /transcrever, Content-Type do áudio) e recebe {"texto": "..."}.
Instalação: backend/transcritor/instalar.sh.
"""
import io
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import av
import numpy as np
from faster_whisper import WhisperModel

PORTA = int(os.environ.get("TRANSCRITOR_PORTA", "8766"))
MODELO = os.environ.get("WHISPER_MODELO", "small")
# Metade dos núcleos: o servidor também roda o CRM, a Laya e o WhatsApp.
THREADS = int(os.environ.get("WHISPER_THREADS", "2"))
LIMITE_BYTES = 25 * 1024 * 1024

modelo = WhisperModel(MODELO, device="cpu", compute_type="int8", cpu_threads=THREADS)
# Um áudio por vez: dois em paralelo só dividiriam os mesmos núcleos.
trava = threading.Lock()


def ler_audio(dados):
    """Áudio (ogg/opus, mp3, m4a, wav...) em 16 kHz mono, do jeito que o Whisper espera.

    Feito aqui e não no faster-whisper: o leitor dele chama av.open(metadata_errors=...),
    que o av 15+ não aceita mais (29/10/2026).
    """
    partes = []
    with av.open(io.BytesIO(dados)) as arquivo:
        conversor = av.AudioResampler(format="s16", layout="mono", rate=16000)
        for quadro in arquivo.decode(audio=0):
            partes += [q.to_ndarray().reshape(-1) for q in conversor.resample(quadro)]
        partes += [q.to_ndarray().reshape(-1) for q in conversor.resample(None)]
    if not partes:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(partes).astype(np.float32) / 32768.0


class Pedido(BaseHTTPRequestHandler):
    def _responder(self, status, corpo):
        dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_GET(self):
        if self.path == "/health":
            return self._responder(200, {"ok": True, "modelo": MODELO})
        self._responder(404, {"erro": "rota não encontrada"})

    def do_POST(self):
        if self.path != "/transcrever":
            return self._responder(404, {"erro": "rota não encontrada"})
        tamanho = int(self.headers.get("Content-Length") or 0)
        if tamanho <= 0:
            return self._responder(400, {"erro": "áudio vazio"})
        if tamanho > LIMITE_BYTES:
            return self._responder(413, {"erro": "áudio muito longo"})
        audio = self.rfile.read(tamanho)
        inicio = time.time()
        try:
            som = ler_audio(audio)
            with trava:
                trechos, info = modelo.transcribe(som, language="pt", vad_filter=True, beam_size=5)
                texto = " ".join(t.text.strip() for t in trechos).strip()
        except Exception as e:  # áudio corrompido ou formato desconhecido
            return self._responder(422, {"erro": f"não consegui ler o áudio: {e}"[:300]})
        self._responder(200, {"texto": texto, "duracao": round(info.duration, 1), "levou": round(time.time() - inicio, 1)})

    def log_message(self, formato, *args):
        print(f"[transcritor] {self.address_string()} {formato % args}", flush=True)


if __name__ == "__main__":
    print(f"[transcritor] modelo {MODELO}, {THREADS} threads, porta {PORTA}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORTA), Pedido).serve_forever()
