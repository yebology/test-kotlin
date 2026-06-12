#!/bin/bash
# ============================================================
# EC2 User Data Script — E2E Test Orchestrator Bootstrap
#
# Instance requirements:
#   - AMI: Ubuntu 22.04 LTS (x86_64)
#   - Type: c5.4xlarge (16 vCPU, 32GB RAM) or larger
#   - Storage: 100GB gp3
#   - Ports: 22 (SSH), 8080 (API trigger, optional)
#
# This script installs:
#   - Android SDK command-line tools + emulator
#   - Node.js 20 LTS
#   - kiro-cli
#   - The orchestrator project
#   - Systemd service for headless execution
# ============================================================

set -euo pipefail
exec > /var/log/e2e-setup.log 2>&1

echo "=== E2E Orchestrator Setup — $(date) ==="

# ─── System Dependencies ─────────────────────────────────────
apt-get update -y
apt-get install -y \
  openjdk-17-jdk \
  unzip \
  wget \
  git \
  python3 \
  python3-pip \
  libpulse0 \
  libgl1-mesa-glx \
  libx11-6 \
  qemu-kvm \
  libvirt-daemon-system

# Enable KVM for emulator hardware acceleration
adduser ubuntu kvm || true
chmod 666 /dev/kvm || true

# ─── Node.js 20 LTS ─────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ─── Android SDK ─────────────────────────────────────────────
ANDROID_HOME=/opt/android-sdk
mkdir -p "$ANDROID_HOME/cmdline-tools"

# Download command-line tools
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
wget -q "$CMDLINE_TOOLS_URL" -O /tmp/cmdline-tools.zip
unzip -q /tmp/cmdline-tools.zip -d "$ANDROID_HOME/cmdline-tools/"
mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
rm /tmp/cmdline-tools.zip

# Set environment
echo "export ANDROID_HOME=$ANDROID_HOME" >> /etc/profile.d/android.sh
echo "export PATH=\$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator" >> /etc/profile.d/android.sh
source /etc/profile.d/android.sh

# Accept licenses and install SDK components
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses || true
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
  "platform-tools" \
  "emulator" \
  "platforms;android-34" \
  "system-images;android-34;google_apis;x86_64"

# Create AVD (headless, no window)
echo "no" | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd \
  -n "test-device-1" \
  -k "system-images;android-34;google_apis;x86_64" \
  --device "pixel_6" \
  --force

echo "no" | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd \
  -n "test-device-2" \
  -k "system-images;android-34;google_apis;x86_64" \
  --device "pixel_6" \
  --force

echo "no" | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd \
  -n "test-device-3" \
  -k "system-images;android-34;google_apis;x86_64" \
  --device "pixel_6" \
  --force

echo "no" | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd \
  -n "test-device-4" \
  -k "system-images;android-34;google_apis;x86_64" \
  --device "pixel_6" \
  --force

# Set permissions
chown -R ubuntu:ubuntu "$ANDROID_HOME"
chmod -R 755 "$ANDROID_HOME"

# ─── kiro-cli ────────────────────────────────────────────────
npm install -g @anthropic/kiro-cli || echo "kiro-cli not yet available on npm"

# ─── Project Setup ───────────────────────────────────────────
PROJECT_DIR=/home/ubuntu/e2e-orchestrator

# Clone or copy project (placeholder — replace with actual repo)
mkdir -p "$PROJECT_DIR"
# git clone https://github.com/your-org/TesAxrail.git "$PROJECT_DIR"

# Install orchestrator dependencies
if [ -d "$PROJECT_DIR/orchestrator" ]; then
  cd "$PROJECT_DIR/orchestrator"
  npm install
fi

chown -R ubuntu:ubuntu "$PROJECT_DIR"

# ─── Systemd Service ────────────────────────────────────────
cat > /etc/systemd/system/e2e-orchestrator.service <<EOF
[Unit]
Description=E2E Test Orchestrator
After=network.target

[Service]
Type=oneshot
User=ubuntu
Group=ubuntu
WorkingDirectory=$PROJECT_DIR/orchestrator
Environment=ANDROID_HOME=$ANDROID_HOME
Environment=PATH=/usr/local/bin:/usr/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/emulator
ExecStart=/usr/bin/npx tsx src/wizard.ts --workers 4 --timeout 1800
RemainAfterExit=yes
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable e2e-orchestrator.service

# ─── Emulator Startup Service ────────────────────────────────
cat > /etc/systemd/system/android-emulators.service <<EOF
[Unit]
Description=Android Emulators (headless)
After=network.target

[Service]
Type=forking
User=ubuntu
Group=ubuntu
Environment=ANDROID_HOME=$ANDROID_HOME
Environment=PATH=/usr/local/bin:/usr/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/emulator
ExecStart=/bin/bash -c ' \
  emulator -avd test-device-1 -port 5554 -no-window -no-audio -no-snapshot-save & \
  emulator -avd test-device-2 -port 5556 -no-window -no-audio -no-snapshot-save & \
  emulator -avd test-device-3 -port 5558 -no-window -no-audio -no-snapshot-save & \
  emulator -avd test-device-4 -port 5560 -no-window -no-audio -no-snapshot-save & \
  wait'
ExecStop=/bin/bash -c ' \
  adb -s emulator-5554 emu kill; \
  adb -s emulator-5556 emu kill; \
  adb -s emulator-5558 emu kill; \
  adb -s emulator-5560 emu kill'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable android-emulators.service

# ─── Optional: Simple HTTP API Trigger ───────────────────────
cat > /home/ubuntu/trigger-server.py <<'PYEOF'
"""Simple HTTP server to trigger E2E runs remotely.

Usage: python3 trigger-server.py
Endpoints:
  POST /run              — Start a new E2E run
  POST /run?resume=true  — Resume last incomplete run
  GET  /status           — Get current run status
  GET  /results          — Get latest results metadata
"""
import subprocess
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime

PROJECT_DIR = "/home/ubuntu/e2e-orchestrator"
RUNS_DIR = os.path.join(PROJECT_DIR, "e2e-runs")
current_process = None


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        global current_process
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/run":
            if current_process and current_process.poll() is None:
                self._respond(409, {"error": "Run already in progress", "pid": current_process.pid})
                return

            args = ["npx", "tsx", "src/wizard.ts", "--workers", "4"]
            if "resume" in params:
                args.append("--resume")
            if "modules" in params:
                args.extend(["--modules", params["modules"][0]])

            current_process = subprocess.Popen(
                args,
                cwd=os.path.join(PROJECT_DIR, "orchestrator"),
                stdout=open("/tmp/e2e-run.log", "w"),
                stderr=subprocess.STDOUT,
            )
            self._respond(200, {"status": "started", "pid": current_process.pid})
        else:
            self._respond(404, {"error": "Not found"})

    def do_GET(self):
        global current_process
        parsed = urlparse(self.path)

        if parsed.path == "/status":
            if current_process is None:
                self._respond(200, {"status": "idle"})
            elif current_process.poll() is None:
                self._respond(200, {"status": "running", "pid": current_process.pid})
            else:
                self._respond(200, {"status": "completed", "exit_code": current_process.returncode})

        elif parsed.path == "/results":
            if not os.path.exists(RUNS_DIR):
                self._respond(200, {"runs": []})
                return
            runs = sorted([d for d in os.listdir(RUNS_DIR) if d.startswith("run-")], reverse=True)
            self._respond(200, {"runs": runs[:10], "latest": runs[0] if runs else None})

        else:
            self._respond(404, {"error": "Not found"})

    def _respond(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8080), Handler)
    print(f"E2E Trigger API running on port 8080")
    server.serve_forever()
PYEOF

# Create trigger API service
cat > /etc/systemd/system/e2e-trigger-api.service <<EOF
[Unit]
Description=E2E Trigger API
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/python3 /home/ubuntu/trigger-server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable e2e-trigger-api.service
systemctl start e2e-trigger-api.service

# ─── Finish ──────────────────────────────────────────────────
echo "=== Setup Complete — $(date) ==="
echo "Emulators will start on next boot or: systemctl start android-emulators"
echo "Run orchestrator: systemctl start e2e-orchestrator"
echo "Trigger API: http://$(hostname -I | awk '{print $1}'):8080"
