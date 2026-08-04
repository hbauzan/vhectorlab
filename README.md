# VHectorLab 3D

Visualización 3D (WebGL/Three.js) y aritmética vectorial sobre embeddings semánticos (`A − B + C`).

---

## Requisitos (una sola vez)

Antes de arrancar, necesitás estas herramientas instaladas en tu máquina:

| Herramienta | Para qué | Cómo instalar |
| :--- | :--- | :--- |
| **[uv](https://docs.astral.sh/uv/)** | Backend Python | [Instrucciones oficiales](https://docs.astral.sh/uv/getting-started/installation/) |
| **[Node.js](https://nodejs.org/)** (incluye `npm`) | Frontend Vite | Descargá el LTS desde [nodejs.org](https://nodejs.org/) |

Comprobá que están disponibles:

```bash
uv --version
npm --version
```

---

## Arranque rápido (recomendado)

Todo el flujo diario pasa por el panel `setup.sh`. Desde la raíz del repo:

```bash
# 1. Clonar (si todavía no lo hiciste)
git clone <url-del-repo>
cd lsv2

# 2. Configurar entorno (opcional pero recomendado)
cp .env.example .env

# 3. Instalar dependencias del frontend (primera vez)
npm install

# 4. Abrir el panel de control
./setup.sh
```

En el menú, elegí la **opción `1`** (`Desplegar / Iniciar Herramienta`).

Esa opción hace todo sola:

1. Verifica que `uv` y `npm` estén instalados
2. Genera `public/vocab.txt` si no existe
3. Corre los tests de backend y frontend
4. Levanta backend (`http://127.0.0.1:8000`) + frontend (`http://127.0.0.1:5173`)
5. Abre el navegador en la app

Cuando termine, la app queda en:

👉 **http://127.0.0.1:5173**

Para salir de los logs en vivo: `Ctrl+C`.  
Para apagar servicios: volvé a `./setup.sh` y elegí la **opción `10`**.

---

## Menú de `setup.sh` (resumen)

| Opción | Qué hace |
| :--- | :--- |
| **1** | Flujo completo: verificar → testear → iniciar → abrir browser |
| **2** | Solo backend FastAPI en `:8000` |
| **3** | Heartbeat / health check del sistema |
| **4** | Tests del frontend (Vitest) |
| **5** | Tests del backend (pytest) |
| **6** | Vocabulario: cargar archivo propio o generar N palabras |
| **7** | Build de imagen Docker para Hugging Face Spaces |
| **8** | Publicar Space en Hugging Face |
| **9** | Ver logs del backend |
| **10** | Parar / limpiar servicios |
| **0** | Salir |

---

## Variables de entorno

Copiá `.env.example` → `.env` y editá solo lo que necesites. Las más comunes:

| Variable | Default | Descripción |
| :--- | :--- | :--- |
| `HOST` / `PORT` | `127.0.0.1` / `8000` | Dónde escucha el backend |
| `MODEL_NAME` | `all-mpnet-base-v2` | Modelo de embeddings |
| `VOCAB_PATH` | `public/vocab.txt` | Vocabulario de la app |
| `VITE_API_BASE_URL` | `/api` | Base URL del API para el browser |
| `VITE_SHOW_CAM_POSE` | `false` | Overlay de cámara (debug de vista) |

---

## Arranque manual (sin panel)

Solo si preferís no usar `setup.sh`:

```bash
# Backend
cd backend
uv sync --extra dev
uv run python -m server

# Frontend (otra terminal, desde la raíz del repo)
npm install
npx vite --port 5173 --host 127.0.0.1
```

---

## Problemas frecuentes

| Sintoma | Qué revisar |
| :--- | :--- |
| `uv: command not found` | Instalá `uv` (tabla de requisitos) |
| `npm: command not found` | Instalá Node.js LTS |
| Tests de backend fallan / tarda mucho | La primera vez descarga el modelo; necesitás red |
| El browser no abre la app | Entrá a mano a http://127.0.0.1:5173 |
| Puerto ocupado | Opción `10` en `setup.sh`, o cerrá procesos viejos de Vite/backend |
