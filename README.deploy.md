# Desplegament al teu propi VPS

Aquesta guia explica com agafar tot el codi de l'aplicació, pujar-lo a GitHub i servir-lo des del teu VPS, mantenint Supabase com a base de dades.

## Arquitectura

```
┌─────────────┐        ┌──────────────┐        ┌─────────────┐
│  Navegador  │───────▶│  VPS (Nginx) │───────▶│  Supabase   │
│             │        │              │        │  (BD, Auth) │
│             │        │  ├─ dist/    │        └─────────────┘
│             │        │  │  (React)  │
│             │        │  └─ Express  │
│             │        │     api      │
└─────────────┘        └──────────────┘
```

- **Frontend (Vite + React)**: build estàtic servit per Nginx/Caddy.
- **Backend Express** (`vps-backend/`): substitueix les Edge Functions i gestiona uploads.
- **Supabase**: continua sent la base de dades i auth (no es migra).

## Passos

### 1. Connectar a GitHub

Des de Lovable → menú `+` → GitHub → Connect project → Create repository.

### 2. Clonar al VPS

```bash
cd /var/www
git clone https://github.com/<usuari>/elmussolet.git elmussolet
cd elmussolet
```

### 3. Variables d'entorn del frontend

Crea `.env.production` a l'arrel:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
VITE_SUPABASE_PROJECT_ID=xxxxx
```

Aquests valors són els de la teva instància Supabase (la clau publishable/anon és pública, no és un secret).

### 4. Build del frontend

```bash
npm install
npm run build
# El resultat queda a dist/
```

### 5. Backend Express

Vegeu `vps-backend/README.md`.

### 6. Nginx — exemple complet

```nginx
# Frontend
server {
  listen 80;
  server_name elmussolet.com www.elmussolet.com;
  root /var/www/elmussolet/dist;
  index index.html;

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~* \.(js|css|woff2?|ttf|otf|svg|png|jpg|jpeg|gif|webp|avif)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}

# API (vegeu vps-backend/README.md)
# Media (vegeu vps-backend/README.md)
```

Després activa HTTPS amb `certbot --nginx -d elmussolet.com -d www.elmussolet.com`.

### 7. Configuració a Admin

Un cop tot està en marxa, ves a `/admin/configuracio/general` i omple el bloc **Desplegament i mitjans**:

| Camp | Exemple | Quan emplenar-lo |
|---|---|---|
| `site_canonical_url` | `https://elmussolet.com` | Sempre |
| `media_base_url` | `https://media.elmussolet.com` | Quan activis VPS storage |
| `assets_base_url` | (vacío) | Opcional |
| `api_base_url` | `https://api.elmussolet.com` | Quan desplegues vps-backend |
| `storage_provider` | `supabase` o `vps` | `supabase` per defecte |

## Pla de migració per fases

| Fase | Què fa | Estat |
|---|---|---|
| **1** | Codi a GitHub + camps Admin + `vps-backend/` skeleton + helper `resolveMediaUrl` | ✅ Llest |
| **2** | Migrar uploads del frontend a `POST /upload/:bucket` quan `storage_provider=vps` | Pendent |
| **3** | Substituir `supabase.functions.invoke()` per `fetch(api_base_url)` a les 3 funcions migrades | Pendent |
| **4** | Script de migració de les imatges existents de Supabase Storage → VPS | Pendent |

Quan vulguis avançar de fase, indica-ho a Lovable.

## Què queda a Supabase

- PostgreSQL (taules, RLS, funcions DB)
- Supabase Auth (sessions, JWT)
- Supabase Storage (fins que activis `storage_provider=vps` i migris les imatges)
- Edge Functions (fins que migrem a `api_base_url`)

## Què passa al VPS

- Codi React compilat (`dist/`)
- `vps-backend/` (Express)
- `/var/www/elmussolet/media/` (imatges, quan actives VPS storage)
