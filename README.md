# BJJ Instructional Processor

Plataforma de procesamiento de instruccionales de Brazilian Jiu-Jitsu. Detecta capitulos, genera subtitulos, dobla al castellano y ofrece una interfaz web para gestionar todo el proceso.

## Arquitectura

```
python/
  bjj-base/               Imagen Docker base compartida (CUDA 12.4 + torch + FastAPI)
  bjj_service_kit/        Paquete compartido: app factory, SSE, runner, logs
  chapter-splitter/       Fragmentacion de capitulos. Dos modos:
                            - oracle (default): BJJFanatics scraper + ffmpeg. Imagen ~200MB.
                            - signal (profile): OCR + Demucs + GPU. Imagen ~13GB.
  subtitle-generator/     Generacion de subtitulos (WhisperX + filtro alucinaciones)
  dubbing-generator/      Doblaje al castellano (Coqui XTTS v2 + clonacion de voz)
  processor-api/          API REST (FastAPI) que orquesta los 4 backends
  processor-frontend/     Interfaz web (React 18 + Tailwind + Zustand)
```

Cada proyecto es independiente, con su propio `requirements.txt`, tests y Dockerfile.

### Detección de capítulos: modos

El 100% de la biblioteca proviene de **BJJFanatics**, que publica los títulos y timestamps de cada volumen en la página del producto. El chapter-splitter explota ese hecho:

**Oracle (default, recomendado)** — scrapea la página del producto → obtiene volúmenes + capítulos + start/end exactos → corta mp4 con `ffmpeg -c copy`. Sin OCR, sin GPU, sin Demucs. Precisión casi perfecta, nombres de capítulo oficiales. Además descarga el póster automáticamente si falta.

**Signal (fallback, opt-in)** — detector por señales (OCR EasyOCR + Demucs voice separation + heurísticas de fondo/audio). Pesado (13GB, GPU), queda para instruccionales no scrapeables. Se levanta solo cuando se necesita:

```bash
docker compose --profile signal up -d chapter-splitter-signal
```

### Proveedores (oracle) pluggables

Cada sitio implementa el protocolo `OracleProvider` (`chapter_splitter/oracle/provider.py`). Hoy solo BJJFanatics (`oracle/providers/bjjfanatics.py`). Añadir un sitio nuevo:
1. Crear `chapter_splitter/oracle/providers/<slug>.py` implementando `id`, `display_name`, `domains`, `search()`, `scrape()`.
2. Tests con fixtures HTML reales en `tests/fixtures/`.
3. Reiniciar el servicio. Auto-descubierto por `ProviderRegistry.discover()`.

No se toca el core. El frontend expone la URL y los capítulos resultantes para edición manual si hiciera falta.

---

## Requisitos previos

| Software | Version minima | Para que |
|----------|---------------|----------|
| **Python** | 3.10+ | Backends de procesamiento |
| **Node.js** | 18+ (recomendado 20 LTS) | Frontend Vue |
| **FFmpeg** | 4.0+ | Codificacion y extraccion de audio |
| **CUDA** (opcional) | 11.8+ | Aceleracion GPU para ML (WhisperX, Demucs, EasyOCR, TTS) |
| **Git** | Cualquiera | Control de versiones |
| **Docker** (opcional) | 20+ | Despliegue containerizado |

### Verificar requisitos

```bash
python --version          # Python 3.10+
node --version            # v18+ o v20+
ffmpeg -version           # ffmpeg version 4+
nvidia-smi                # (opcional) verifica CUDA
docker --version          # (opcional) Docker 20+
```

---

## Opcion A: Lanzamiento local (desarrollo)

### Paso 1: Crear entornos virtuales

Cada proyecto necesita su propio venv para evitar conflictos de dependencias.

```bash
cd C:\proyectos\python

# Chapter Splitter
cd chapter-splitter
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
deactivate
cd ..

# Subtitle Generator
cd subtitle-generator
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
deactivate
cd ..

# Dubbing Generator
cd dubbing-generator
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
deactivate
cd ..

# Processor API
cd processor-api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
pip install requests
deactivate
cd ..
```

### Paso 2: Instalar dependencias del frontend

```bash
cd processor-frontend
npm install
cd ..
```

### Paso 3: Ejecutar los tests

```bash
# Chapter Splitter
cd chapter-splitter
venv\Scripts\activate
python -m pytest tests/ -v
deactivate
cd ..

# Subtitle Generator
cd subtitle-generator
venv\Scripts\activate
python -m pytest tests/ -v
deactivate
cd ..
```

### Paso 4: Lanzar la API (backend)

Abrir una terminal:

```bash
cd C:\proyectos\python\processor-api
venv\Scripts\activate
uvicorn api.app:app --reload --port 8000
```

La API estara disponible en `http://localhost:8000`.

Endpoints principales:
- `GET /` — Interfaz web (legacy, template HTML)
- `POST /api/scan` — Escanear biblioteca de videos
- `GET /api/video-info?path=...` — Info de un video (ffprobe)
- `POST /api/jobs` — Crear trabajo (chapters/subtitles/dubbing)
- `GET /api/jobs/{id}/events` — Progreso en tiempo real (SSE)
- `GET /api/search?q=...` — Buscar en subtitulos
- `GET /api/voice-profiles` — Listar perfiles de voz
- `POST /api/export/ossflow` — Exportar a OssFlow

### Paso 5: Lanzar el frontend

Abrir otra terminal:

```bash
cd C:\proyectos\python\processor-frontend
npm run dev
```

El frontend estara disponible en `http://localhost:3000`.

El proxy de Vite redirige automaticamente `/api/*` a `http://localhost:8000`.

### Paso 6: Usar la aplicacion

1. Abrir `http://localhost:3000` en el navegador
2. Pulsar el boton de carpeta o escribir la ruta de tu biblioteca (ej: `Z:\instruccionales`)
3. Pulsar "Escanear Biblioteca"
4. Hacer click en un video para ver su detalle
5. Usar los botones de accion: "Detectar Capitulos", "Generar Subtitulos", etc.
6. El progreso se muestra en tiempo real via Server-Sent Events

---

## Opcion B: Lanzamiento con Docker

### Paso 1: Configurar la ruta de la biblioteca

```bash
cd C:\proyectos
copy .env.example .env
```

Editar `.env` y poner la ruta de tu biblioteca:

```
BJJ_LIBRARY_PATH=Z:/instruccionales
```

### Paso 2: Construir y lanzar

```bash
cd C:\proyectos

# 1. Base compartida (una vez, o al cambiar deps comunes)
docker build -t bjj-base:latest -f python/bjj-base/Dockerfile python/

# 2. Build + up de los servicios por defecto (chapter-splitter en modo oracle lean)
docker compose build
docker compose up -d
```

Esto levanta (perfil por defecto, sin signal):
- **processor-api** en `http://localhost:8000`
- **processor-frontend** en `http://localhost:3000`
- **chapter-splitter** (oracle lean, ~200MB) en `http://localhost:8001`
- **subtitle-generator** (WhisperX, GPU) en `http://localhost:8002`
- **dubbing-generator** (Coqui XTTS v2, GPU) en `http://localhost:8003`

El detector por señales (`chapter-splitter-signal`, 13GB + GPU) NO arranca por defecto. Si alguna vez lo necesitas:

```bash
docker compose --profile signal up -d chapter-splitter-signal
```

### Flujo oracle desde la UI

1. `http://localhost:3000` → biblioteca → click en un instruccional.
2. Botón **"Oráculo"** → se abre el editor.
3. Si es la primera vez:
   - **"Resolver automáticamente"** busca el producto en BJJFanatics por nombre+autor. Muestra top-3 con score.
   - Si el top coincide, **"Scrapear"**. Si no, pega la URL correcta manualmente y **"Scrapear"**.
4. Revisa/edita la tabla de volúmenes y capítulos (MM:SS) si necesario → **"Guardar"**.
5. **"Procesar con oráculo"** dispara el pipeline y corta los mp4 en `Season NN/`.
6. Si faltaba póster, se descarga automáticamente de la página del producto como `poster.jpg`.

Página global `/oracle/providers` muestra los providers registrados en el backend.

### Verificación end-to-end (eval)

El repo incluye un script de verificación sobre el instruccional Tripod Passing - Jozef Chen:

```bash
docker compose exec chapter-splitter python -m scripts.eval_oracle \
  --title "Tripod Passing" --author "Jozef Chen" \
  --instructional-dir "/media/instruccionales/Tripod Passing - Jozef Chen" --dry-run
```

Verifica search, scrape y (sin `--dry-run`) el corte físico. Exit code 0 si todo PASS.

### Paso 3: Ver logs

```bash
docker compose logs -f processor-api
docker compose logs -f processor-frontend
```

### Paso 4: Parar

```bash
docker compose down
```

---

## Uso de cada proyecto por separado (CLI)

### Chapter Splitter

Detecta capitulos y fragmenta videos:

```bash
cd C:\proyectos\python\chapter-splitter
venv\Scripts\activate

# Escanear y fragmentar (genera archivos en Season XX/)
python -m chapter_splitter "Z:\instruccionales\Arm Drags - John Danaher"

# Solo detectar sin cortar (dry run)
python -m chapter_splitter "Z:\instruccionales\Arm Drags" --dry-run

# Con mas detalle en logs
python -m chapter_splitter "Z:\instruccionales\Arm Drags" --verbose

# Ajustar umbrales
python -m chapter_splitter "Z:\instruccionales\Arm Drags" --voice-threshold 0.20 --ocr-confidence 0.5

deactivate
```

### Subtitle Generator

Genera subtitulos .srt con WhisperX:

```bash
cd C:\proyectos\python\subtitle-generator
venv\Scripts\activate

# Generar subtitulos para todos los videos de una carpeta
python -m subtitle_generator "Z:\instruccionales\Arm Drags\Season 01"

# Con modelo especifico y batch size
python -m subtitle_generator "Z:\instruccionales\Arm Drags" --model large-v3 --batch-size 8

# Con prompt para vocabulario tecnico
python -m subtitle_generator "Z:\instruccionales\Arm Drags" --prompt "BJJ instructional by John Danaher on Arm Drags"

# Con logs detallados
python -m subtitle_generator "Z:\instruccionales\Arm Drags" --verbose

deactivate
```

### Dubbing Generator

Genera doblaje al castellano (requiere GPU con VRAM suficiente):

```bash
cd C:\proyectos\python\dubbing-generator
venv\Scripts\activate

# (Este proyecto esta en desarrollo - la logica esta en dubbing_generator/dubbing.py)
# Necesita un SRT traducido (_ESP_DUB.srt) previamente generado

deactivate
```

---

## Estructura de archivos de cada proyecto

### chapter-splitter/
```
chapter_splitter/
  __init__.py          Exporta Config y Pipeline
  __main__.py          CLI con argparse
  config.py            Dataclass Config con todos los parametros
  models.py            OcrResult, Chapter
  utils.py             sanitize_filename, extract_season_number
  pipeline.py          Orquestador principal
  ocr/
    preprocessor.py    CLAHE, Otsu, adaptive threshold, ROI crop
    reader.py          Multi-frame OCR con votacion y confianza
  audio/
    analyzer.py        Demucs voice separation, voice map pre-computed
  detection/
    background_memory.py  Memoria ponderada con decay
    stability.py          Verificacion multi-frame (3 frames, 3 segundos)
    detector.py           Maquina de estados de deteccion
  splitting/
    splitter.py        FFmpeg two-pass seeking + NVENC
tests/
  conftest.py          Fixtures compartidos
  test_config.py       Tests de configuracion
  test_utils.py        Tests de utilidades
  test_background_memory.py  Tests de memoria
  test_preprocessor.py Tests de preprocesado OCR
  test_splitter.py     Tests de comandos FFmpeg
```

### subtitle-generator/
```
subtitle_generator/
  __init__.py
  __main__.py          CLI con argparse
  config.py            TranscriptionConfig + SubtitleConfig
  cuda_setup.py        Parches NVIDIA DLL + PyTorch safety
  pipeline.py          Orquestador: transcribe -> align -> filter -> write
  hallucination_filter.py  5 filtros anti-alucinaciones
  timestamp_fixer.py   Interpolacion, overlaps, gaps, duration clamp
  writer.py            SRT con line-breaking por puntuacion
  validator.py         Validacion post-escritura con metricas
  utils.py             format_timestamp
tests/
  conftest.py
  test_config.py
  test_utils.py
  test_hallucination_filter.py  22 tests
  test_timestamp_fixer.py       16 tests
  test_writer.py                10 tests
  test_validator.py             10 tests
```

### processor-api/
```
api/
  app.py               FastAPI (22 endpoints)
  templates/
    index.html          UI legacy (fallback sin Vue)
  static/
    css/style.css
    js/app.js
chapter_tools/
  mkv_chapters.py      Generacion/embedding de capitulos MKV
  plex_exporter.py     Export estructura Plex/Jellyfin
voice_profiles/
  manager.py           Perfiles de voz por instructor
search/
  indexer.py           Indice de subtitulos + busqueda full-text
ossflow_client/
  client.py            Cliente para exportar a OssFlow (Spring Boot)
```

### processor-frontend/
```
src/
  main.js              Bootstrap Vue + Pinia + Router
  App.vue              Layout con sidebar
  router/index.js      Rutas: /, /search, /voice-profiles, /settings
  api/client.js        Cliente API (fetch)
  stores/
    library.js          Estado de la biblioteca
    jobs.js             Tracking de trabajos con SSE
  views/
    LibraryView.vue     Biblioteca + panel detalle
    SearchView.vue      Busqueda cross-instruccional
    VoiceProfilesView.vue  Perfiles de voz
    SettingsView.vue    Conexion OssFlow + export Plex
  components/
    InstructionalCard.vue
    VideoDetailPanel.vue
    JobMonitor.vue
    SubtitlePreview.vue
    SearchResult.vue
```

---

## Solucion de problemas

### "No se encontraron instruccionales"
- Verifica que la ruta existe y contiene archivos .mp4, .mkv, .avi o .mov
- En Docker, asegurate de que `BJJ_LIBRARY_PATH` en `.env` apunta al directorio correcto

### Error de CUDA / GPU
- Los proyectos funcionan en CPU pero mucho mas lento
- Para GPU: instalar CUDA Toolkit 11.8+ y las versiones de torch con soporte CUDA:
  ```bash
  pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
  ```

### Error "unhashable type: dict" en processor-api
- Ya corregido. Si persiste, actualizar FastAPI: `pip install -U fastapi starlette`

### FFmpeg no encontrado
- Descargar de https://ffmpeg.org/download.html
- Asegurarse de que `ffmpeg` y `ffprobe` estan en el PATH del sistema

### El frontend no conecta con la API
- Verificar que la API esta corriendo en puerto 8000
- En desarrollo, el proxy de Vite redirige `/api/*` automaticamente
- En Docker, nginx hace de reverse proxy
