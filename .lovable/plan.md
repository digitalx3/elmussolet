
## Problema

`src/components/ui/rich-text-editor.tsx` utilitza ReactQuill, que internament converteix HTML → Delta → HTML. Aquesta conversió:

- Descarta tags i atributs no whitelistejats (`div`, `section`, `class`, `id`, `style`, `data-*`…).
- Reinterpreta llistes, paràgrafs buits i espais (afegeix `&nbsp;`, embolcalla en `<p>`, fusiona blocs).
- S'executa cada vegada que Quill es munta amb un `value`, encara que l'usuari no editi.

L'`userEditedRef` actual mitiga el cas "munto i no edito", però en el moment que l'usuari fa un sol clic a la barra d'eines o prem una tecla, Quill emet la versió normalitzada i sobreescriu el HTML original. Per això, en desar i tornar a entrar, el codi apareix alterat (llistes inventades, espais, estructura modificada).

## Objectiu

El **mode HTML és la font de la veritat**. El mode visual només pot modificar el HTML quan l'usuari ho confirma explícitament; en cap altre cas el codi original pot ser reformatat.

## Canvis proposats

Tots dins de `src/components/ui/rich-text-editor.tsx` (cap canvi a `AdminPages.tsx` ni a la base de dades; cap impacte al frontend públic que ja renderitza el HTML cru).

### 1. Vista visual segura per defecte = preview (iframe sandbox)

En entrar a `mode === 'visual'`, mostrar per defecte un **preview** del HTML dins un `<iframe sandbox>` amb els estils bàsics del lloc. Aquest preview:

- No pot modificar el `value` (és només lectura).
- Mostra el HTML idènticament a com es desa, sense passar per Quill.
- Inclou un botó **"Editar visualment"** que activa explícitament Quill.

### 2. Edició visual com a acció explícita

Quan l'usuari prem "Editar visualment":

- Es munta ReactQuill amb el HTML actual.
- Apareix un avís: "Els canvis visuals poden reformatar el HTML. Confirma per aplicar-los."
- Mentre s'edita, el `value` extern NO es modifica.
- Dos botons: **"Aplicar canvis"** (commiteja el HTML normalitzat per Quill via `onChange`) i **"Cancel·lar"** (descarta i torna al preview amb el HTML original intacte).

Això elimina completament les normalitzacions accidentals: només es desa HTML reformatat si l'usuari ho demana explícitament.

### 3. Mode HTML sense canvis funcionals

El `<textarea>` ja desa el contingut tal qual. Es manté.

### 4. Ampliar la whitelist de Quill (per minimitzar pèrdues quan l'usuari sí edita visualment)

Afegir al `formats` de Quill els formats inline addicionals que ja suporta natiu: `script`, `direction`. Mantenir `matchVisual: false` al clipboard. No registrem blots custom per a `div`/`section`/`class` perquè és invasiu i fora de l'abast d'aquest fix; la regla "edició visual = pot reformatar" cobreix aquest cas amb un avís clar.

### 5. Eliminar la heurística `userEditedRef`

Ja no cal: en mode preview no es pot editar; en mode "edició visual explícita" els canvis només es propaguen amb "Aplicar canvis".

## Flux UX resultant

```text
[HTML mode]  <-->  [Visual preview (iframe, read-only)]
                          |
                          | "Editar visualment"
                          v
                   [Visual edit (Quill)]
                    |              |
              "Aplicar"        "Cancel·lar"
                    |              |
                    v              v
              commit onChange   descarta
```

## Verificació

1. Enganxar HTML amb `<div class="grid">…</div>` al mode HTML, canviar a visual → veure el preview correcte, tornar a HTML → codi idèntic.
2. Enganxar text pla al mode HTML → no apareixen llistes ni `&nbsp;` en cap moment.
3. Editar a "Editar visualment", prémer "Cancel·lar" → el HTML original no canvia.
4. Editar a "Editar visualment", prémer "Aplicar canvis" → el HTML resultant es desa (es pot acceptar la reformatació de Quill perquè és explícita).
5. Desar la pàgina, recarregar `/admin/pagines/:id`, comprovar que el HTML és estable.
6. Validar al front-end que `CmsPagePage.tsx` segueix renderitzant correctament.

## Fitxers afectats

- `src/components/ui/rich-text-editor.tsx` — única modificació.
