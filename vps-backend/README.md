# El Mussolet — Backend VPS

Backend Express que reemplaça les Edge Functions de Supabase i serveix els uploads d'imatges quan es fa self-hosting.

## Estructura

```
vps-backend/
├── src/
│   ├── server.js                     # Entry point Express
│   ├── lib/auth.js                   # JWT + supabase admin client
│   └── routes/
│       ├── upload.js                 # POST /upload/:bucket
│       ├── verify-list-access.js     # POST /functions/verify-list-access
│       ├── hash-password-util.js     # POST /functions/hash-password-util
│       └── send-order-status-email.js
├── .env.example
├── ecosystem.config.cjs              # PM2
└── package.json
```

## Instal·lació al VPS

```bash
cd /var/www/elmussolet
git clone <repo-url> .
cd vps-backend
cp .env.example .env
# Edita .env amb les teves credencials
npm install
npx pm2 start ecosystem.config.cjs
npx pm2 save
```

## Nginx — exemple

```nginx
# API
server {
  server_name api.elmussolet.com;
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Authorization $http_authorization;
  }
}

# Media (serveix directament UPLOAD_DIR)
server {
  server_name media.elmussolet.com;
  root /var/www/elmussolet/media;
  location / {
    add_header Access-Control-Allow-Origin "*";
    expires 30d;
    try_files $uri =404;
  }
}
```

## Endpoints

| Mètode | Ruta | Auth | Descripció |
|---|---|---|---|
| GET | `/health` | — | Healthcheck |
| POST | `/upload/:bucket` | admin | Puja un fitxer (form-data `file`) |
| DELETE | `/upload/:bucket/*` | admin | Elimina un fitxer |
| POST | `/functions/verify-list-access` | — | Verifica codi + contrasenya de llista |
| POST | `/functions/hash-password-util` | admin | Hash bcrypt d'una contrasenya |
| POST | `/functions/send-order-status-email` | admin | Envia email de canvi d'estat |

Buckets permesos: `product-images`, `brand-logos`, `site-assets`.

## Fase actual

Aquest backend està llest però **no s'utilitza encara**. Els uploads continuen anant a Supabase Storage. Per activar-lo:

1. Desplega aquest backend al VPS.
2. A l'Admin → Configuració → General, omple `api_base_url` i `media_base_url`.
3. Canvia `storage_provider` a `vps`.
4. (Fase 2) Migrarem els punts d'upload del frontend per usar aquest endpoint.
