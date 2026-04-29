# ossflow-scrapper

Servicio de scraping de proveedores de instruccionales para el ecosistema OSSFlow.

## Proveedores soportados

- BJJ Fanatics (actual)
- Grappling Industries (fase 2)
- FloGrappling (fase 2)
- YouTube (fase 2)

## Endpoints

- `POST /scrape` — extrae capítulos y timestamps de una URL
- `GET /search?q=...` — búsqueda cross-provider
- `GET /health`, `/gpu`, `/logs`

## Arranque

```bash
docker compose up -d
```

Se conecta a la network compartida `ossflow_net` definida por `ossflow-platform`.
