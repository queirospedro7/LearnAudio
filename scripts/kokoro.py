import json
import os
import sys

payload = json.loads(sys.stdin.buffer.read().decode('utf-8'))
os.environ['HF_HOME'] = os.path.join(payload['cache'], 'hf')
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
from tts_eu_pt import TTS

model = os.path.join(payload['cache'], 'model', 'tuga_kokoro.pth')
voicepack = os.path.join(payload['cache'], 'model', 'tuga_voicepack.pt')
if os.path.isfile(model) and os.path.isfile(voicepack):
    tts = TTS(device='cpu', model_path=model, voicepack_path=voicepack)
else:
    raise RuntimeError('Os ficheiros da voz Tuga estao em falta no projeto.')
tts.save(payload['out'], payload['text'])
