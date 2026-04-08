# jetson-compass

> Jetson Super Orin Nano 8GB — field deployment guide, optimization toolkit, and verified hardware configurations.

## Verified Hardware

| Component | Spec | Status |
|-----------|------|--------|
| SoC | Jetson Super Orin Nano 8GB | ✅ Verified |
| CUDA | 12.9 | ✅ |
| Compute | sm_87 (Orin) | ✅ |
| Memory | 8GB shared (GPU+CPU) | ✅ |
| Storage | 2TB NVMe | ✅ |
| NVIDIA Warp | Verified on Jetson | ✅ |

## Memory Budget (8GB shared)

The 8GB is shared between GPU, CPU, and OS. Typical allocation:

```
OS + System:    ~1.5GB
Python/Node:    ~0.5GB
Available:      ~6.0GB

Model budgets (cold, activated on demand):
- Whisper-large-v3:    ~3GB (GPU) — TOO BIG, use medium (1.5GB)
- Whisper-medium:      ~1.5GB (GPU) ✅ fits
- Qwen2.5-7B Q4:       ~4GB (GPU) — tight, use smaller
- Phi-3-mini Q4:       ~2GB (GPU) ✅ fits  
- CodeQwen-7B Q4:      ~4GB (GPU) — tight
- JEPA-v2:             ~2GB (GPU) ✅ fits
- TTS (espeak):        ~50MB (CPU) ✅ trivial

Rule: Only ONE GPU model active at a time on 8GB Orin.
Pipeline: STT (load) → process → unload → LLM (load) → process → unload → TTS (load)
```

## Local Model Stack

### STT (Speech-to-Text)
```bash
# OpenAI Whisper — verified on Jetson
pip install openai-whisper
whisper medium --model_dir /opt/models/whisper-medium

# GPU usage: ~1.5GB for medium, ~3GB for large (too big)
# Recommended: medium for field use
# Fallback: tiny (~75MB) for very constrained scenarios
```

### TTS (Text-to-Speech)
```bash
# Piper TTS — fast, local, <100MB
pip install piper-tts
piper --model en_US-lessac-medium --output-raw | aplay

# Or espeak-ng (ultra-lightweight, ~5MB)
espeak-ng "Hello Captain"
```

### Vision (JEPA)
```bash
# Meta JEPA v2 — world model for scene understanding
# Requires custom build for Jetson (ARM64)
# GPU usage: ~2GB
# Used for: understanding boat/environment, not real-time video
```

### Text Generation
```bash
# llama.cpp for GGUF models on Jetson
CMAKE_ARGS="-DLLAMA_CUDA=on" pip install llama-cpp-python

# Phi-3-mini-4k-instruct Q4 (best fit for 8GB)
wget https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf

# Qwen2.5-7B-Instruct Q4 (if no other GPU models needed)
wget https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf
```

## File System Layout

```
/opt/captain/
├── models/                    # Cold model storage
│   ├── whisper-medium/        # STT
│   ├── phi-3-mini/            # Text generation
│   ├── jepa-v2/               # Vision
│   └── tts/                   # TTS models
├── repos/                     # Git-agent repos (fleet cold storage)
│   ├── capitaine/             # Captain's main agent
│   ├── the-seed/              # Self-evolution agent
│   ├── fleet-orchestrator/    # Fleet coordination
│   └── ...                    # Other agent repos
├── data/                      # Runtime data
│   ├── transcripts/           # Conversation transcripts
│   ├── projects/              # Active project data
│   └── config/                # Configuration
├── web/                       # Local web interface
│   ├── static/                # HTML/CSS/JS
│   └── server.py              # Web server (Starlette)
├── scripts/
│   ├── setup-network.sh       # Network auto-configuration
│   ├── model-manager.py       # Load/unload models
│   └── backup-to-sd.sh        # SD card backup
└── captain.service            # Systemd service
```

## Network Configuration

```bash
#!/bin/bash
# /opt/captain/scripts/setup-network.sh
# Priority: Starlink > Boat WiFi > Phone Hotspot > Air-gapped

connect_phone_hotspot() {
    # USB tethering (most reliable)
    sudo dhclient usb0
}

connect_starlink() {
    # Starlink dish provides standard WiFi
    # Auto-connect to SSID "Starlink"
    nmcli dev wifi connect "Starlink"
}

connect_boat_wifi() {
    # Connect to boat's existing WiFi
    nmcli dev wifi connect "$BOAT_SSID" password "$BOAT_PASSWORD"
}

setup_cloudflare() {
    # Cloudflare Tunnel for cloud connectivity
    cloudflared tunnel --url http://localhost:8080 &
}

# Try each in order
connect_starlink 2>/dev/null || connect_boat_wifi 2>/dev/null || connect_phone_hotspot
setup_cloudflare 2>/dev/null  # Non-blocking, best-effort
```

## Model Manager (Lazy Loading)

```python
# /opt/captain/scripts/model-manager.py
import subprocess, threading, time

class ModelManager:
    def __init__(self):
        self.current_model = None
        self.lock = threading.Lock()
    
    def load(self, model_name):
        with self.lock:
            if self.current_model == model_name:
                return
            self._unload()  # Unload current if any
            # Loading happens per-application, manager tracks state
            self.current_model = model_name
    
    def _unload(self):
        if self.current_model:
            # Send signal to unload (app-specific)
            self.current_model = None
    
    def get_available_memory_gb(self):
        with open('/proc/meminfo') as f:
            meminfo = dict(l.split() for l in f if ':' in l)
            return int(meminfo.get('MemAvailable', '0')) / 1024 / 1024
```

## NVIDIA Warp Verification

```python
# Verified on Jetson Super Orin Nano
import warp as wp
wp.init()  # CUDA 12.9, Orin sm_87, 7GB available
# Use for: physics simulations, sensor fusion, geometric computing
```

## Key Constraints

1. **8GB shared memory** — only ONE GPU model active at a time
2. **Pipeline, not parallel** — STT → unload → LLM → unload → TTS
3. **Phone as I/O** — Jetson computes, phone provides mic/speaker/UX
4. **Local-first** — works without internet, cloud is enhancement
5. **Cold storage** — models loaded on demand, never all at once
6. **Phone hotspot fallback** — USB tethering most reliable
7. **Whisper medium > large** — large doesn't fit with anything else

## Deployment Checklist

- [ ] Ubuntu flashed to NVMe (not eMMC)
- [ ] Python 3.10+, Node.js 18+, git installed
- [ ] CUDA 12.9 with JetPack
- [ ] NVIDIA Warp verified
- [ ] Whisper medium downloaded to /opt/captain/models/
- [ ] Phi-3-mini Q4 downloaded to /opt/captain/models/
- [ ] Piper TTS installed
- [ ] All fleet repos cloned to /opt/captain/repos/
- [ ] captain.service systemd unit created
- [ ] Network scripts tested (hotspot, Starlink, boat WiFi)
- [ ] Web interface accessible from phone browser
- [ ] SD card backup of all repos
- [ ] API keys configured (or deferred to on-site setup)

---

<i>Built by [Superinstance](https://github.com/superinstance) & [Lucineer](https://github.com/Lucineer) (DiGennaro et al.)</i>

<i>Powered by [Cocapn](https://github.com/Lucineer/cocapn-ai) — The sovereign agent runtime</i>
