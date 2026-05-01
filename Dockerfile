# Lean image: scrapper endpoints + ffmpeg-based splitting only.
# No torch / cuda / demucs / easyocr / opencv. ~200MB vs ~13GB.
FROM python:3.10-slim

# git is required to install ossflow-service-kit from GitHub.
# ffmpeg is required by ChapterSplitter (subprocess calls).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the shared service kit from ossflow-core.
RUN pip install --no-cache-dir \
    "ossflow-service-kit @ git+https://github.com/yraedry/ossflow-core@v0.1.0#subdirectory=ossflow_service_kit"

# Install lean python deps.
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy the scrapper packages + app entrypoint.
COPY scrapper /app/scrapper
COPY splitting /app/splitting
COPY shared /app/shared
COPY app.py /app/app.py

EXPOSE 8001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
