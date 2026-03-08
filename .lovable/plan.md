

## Estat actual del PRD vs. implementació

### Fases completades ✓
- **Fase 1** — Base de dades, Auth, Layout, i18n, Routing
- **Fase 2** — Catàleg i fitxa de producte
- **Fase 3** — Autenticació, login, registre, perfil, dashboard usuari
- **Fase 4** — Llistes de naixement (accés, vista, compra)
- **Fase 5** — Cistella i checkout (amb càlcul d'enviament i impostos)
- **Fase 6 (parcial)** — Admin: productes, categories, marques, variants, llistes, comandes, enviaments, impostos, estats de comanda

### Fases pendents

#### Fase 6 — Pendents d'admin:
1. **Dashboard admin amb estadístiques** (PRD 6.1 punt 2) — Ara és un placeholder. Falta: targetes resum (comandes pendents, avui, estoc crític, ingressos mes), gràfic vendes 30 dies (recharts), últimes comandes, productes estoc crític.
2. **Gestió de plantilles de llistes** (`/admin/plantilles`) — Placeholder. Falta: CRUD plantilles amb traduccions CA/ES, gestió de productes per plantilla, previsualització.
3. **Gestió d'usuaris** (`/admin/usuaris`) — Placeholder. Falta: llistat usuaris, detall, canvi de rol.
4. **Configuració general** (`/admin/configuracio`) — Parcialment fet (impostos + estats). Falta: dades botiga, config pagaments, config correus, llindar enviament gratuït.

#### Fase 7 — Notificacions email
- Edge Function `send-notification` amb templates HTML per tots els events (registre, compra, canvi estat, etc.)
- Integració amb servei d'email real (Resend)
- Ja existeix `send-order-status-email` com a base parcial

#### Fase 8 — Home page i poliment final
- Home page ja té hero, secció llistes, confiança — però falta: productes destacats reals (ara no carrega del DB), categories amb imatges
- SEO: meta tags dinàmics amb React Helmet (ja instal·lat però potser no complet)
- Poliment: loading states, empty states, breadcrumbs, responsive final

### Recomanació: Què toca ara?

La prioritat lògica seria completar la **Fase 6** amb els 4 punts pendents, començant pel **Dashboard admin amb estadístiques** ja que és la pàgina principal d'admin i donarà visibilitat immediata sobre l'estat de la botiga.

**Ordre suggerit:**
1. Dashboard admin amb estadístiques i gràfics
2. Gestió de plantilles de llistes
3. Gestió d'usuaris
4. Configuració general (dades botiga, pagaments, correus)
5. Fase 7: Notificacions email
6. Fase 8: Poliment final i SEO

