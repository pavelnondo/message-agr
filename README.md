Message Aggregator – Local and VPS Deployment

Quick start
- Copy `.env.example` to `.env` and set credentials.
- Run: `docker compose up -d --build`
- Open frontend at http://localhost:8090, API at http://localhost:8000

Environment variables (.env)
- DB_HOST=db
- DB_PORT=5432
- DB_NAME=message_aggregator
- DB_USER=postgres
- DB_PASSWORD=change_me
- DATABASE_URL=postgresql+asyncpg://postgres:change_me@db:5432/message_aggregator
- BOT_TOKEN=fill
- N8N_WEBHOOK_URL=http://n8n/webhook/xxx (or leave empty)
- JWT_SECRET_KEY=change_me
- MINIO_LOGIN=minio
- MINIO_PWD=change_me
- RABBITMQ_USER=admin
- RABBITMQ_PASSWORD=change_me
- VITE_API_URL=
- VITE_WS_URL=

Notes
- Backend reads `DATABASE_URL` or DB_* parts via `backend/shared.py`.
- Frontend reads `VITE_API_URL`/`VITE_WS_URL` at build/runtime (empty = same origin).
