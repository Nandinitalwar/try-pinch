# Linux dev/test container. Required from Stage 1 onward because macOS
# doesn't have namespaces / seccomp / cgroups.
FROM python:3.12-slim

WORKDIR /app

# Stage 1 will need these; installing now so later stages are cheap rebuilds.
RUN apt-get update && apt-get install -y --no-install-recommends \
        bubblewrap \
        libseccomp-dev \
        libcap-dev \
        strace \
        procps \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["pytest", "-v"]
