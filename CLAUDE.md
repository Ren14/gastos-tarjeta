# gastos-tarjeta

Personal finance app — Go backend (chi + pgx + PostgreSQL) + React/Vite/Tailwind frontend.

## Skills

- **Auto-migrate**: ~/skills/user/auto-migrate/SKILL.md
  Automatically runs `migrate up` on local and production (Render) databases whenever a migration file is created or modified. Config stored at `~/.gastos-tarjeta-migrate.json`.

## Key paths

- Backend: `backend/`
- Frontend: `frontend/`
- Migrations: `backend/db/migrations/`
- Handlers: `backend/internal/handlers/`

## Migration convention

Files follow `000NNN_description.{up,down}.sql`. Always create both up and down files. After creating/modifying any migration file, apply the auto-migrate skill.
