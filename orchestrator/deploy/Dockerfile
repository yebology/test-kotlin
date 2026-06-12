# ============================================================
# E2E Orchestrator Docker Image
# Includes Android SDK, Node.js, and orchestrator code.
# Note: Requires KVM access for emulator hardware acceleration.
# Run with: docker run --privileged -v /dev/kvm:/dev/kvm e2e-orchestrator
# ============================================================

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/emulator"

# System dependencies
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    unzip \
    wget \
    curl \
    git \
    python3 \
    python3-pip \
    libpulse0 \
    libgl1-mesa-glx \
    libx11-6 \
    qemu-kvm \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Android SDK
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
    && wget -q "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -O /tmp/cmdline-tools.zip \
    && unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_HOME}/cmdline-tools/ \
    && mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest \
    && rm /tmp/cmdline-tools.zip

# Accept licenses and install SDK
RUN yes | sdkmanager --licenses || true \
    && sdkmanager "platform-tools" "emulator" "platforms;android-34" "system-images;android-34;google_apis;x86_64"

# Create AVDs
RUN echo "no" | avdmanager create avd -n "device-1" -k "system-images;android-34;google_apis;x86_64" --device "pixel_6" --force \
    && echo "no" | avdmanager create avd -n "device-2" -k "system-images;android-34;google_apis;x86_64" --device "pixel_6" --force \
    && echo "no" | avdmanager create avd -n "device-3" -k "system-images;android-34;google_apis;x86_64" --device "pixel_6" --force \
    && echo "no" | avdmanager create avd -n "device-4" -k "system-images;android-34;google_apis;x86_64" --device "pixel_6" --force

# Orchestrator code
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --production=false

COPY src/ ./src/
COPY wizard.sh ./
RUN chmod +x wizard.sh

# Default: run health check then wizard
ENTRYPOINT ["npx", "tsx"]
CMD ["src/wizard.ts", "--workers", "4"]
