# 🗺️ VectorLab 3D

VectorLab 3D es una herramienta de visualización tridimensional (WebGL/Three.js) y ejecución de **Aritmética Vectorial ($A - B + C$)** sobre embeddings semánticos con respuesta en milisegundos.

## 🚀 Inicio Rápido (Backend)

```bash
# 1. Instalar dependencias backend con uv
cd backend
uv sync --extra dev

# 2. Correr tests unitarios
uv run pytest

# 3. Iniciar servidor FastAPI local
uv run python -m backend.server
```

## 🛠️ Herramientas
- **Generar / Actualizar Vocabulario**:
  ```bash
  python3 scripts/generate_vocab.py --count 10000
  ```
- **Heartbeat & Prueba de Salud**:
  ```bash
  python3 backend/perform_tests.py
  ```
