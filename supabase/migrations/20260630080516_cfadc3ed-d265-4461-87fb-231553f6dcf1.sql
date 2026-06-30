
-- 1. SUBSECTIONS
CREATE TABLE public.default_list_subsections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.default_list_sections(id) ON DELETE CASCADE,
  slug text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, slug)
);
GRANT SELECT ON public.default_list_subsections TO anon, authenticated;
GRANT ALL ON public.default_list_subsections TO service_role, authenticated;
ALTER TABLE public.default_list_subsections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_subsections" ON public.default_list_subsections FOR SELECT USING (true);
CREATE POLICY "admin_write_subsections" ON public.default_list_subsections FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_subsections_updated BEFORE UPDATE ON public.default_list_subsections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. SUBSECTION TRANSLATIONS
CREATE TABLE public.default_list_subsection_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subsection_id uuid NOT NULL REFERENCES public.default_list_subsections(id) ON DELETE CASCADE,
  language text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subsection_id, language)
);
GRANT SELECT ON public.default_list_subsection_translations TO anon, authenticated;
GRANT ALL ON public.default_list_subsection_translations TO service_role, authenticated;
ALTER TABLE public.default_list_subsection_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_subsection_tr" ON public.default_list_subsection_translations FOR SELECT USING (true);
CREATE POLICY "admin_write_subsection_tr" ON public.default_list_subsection_translations FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_subsection_tr_updated BEFORE UPDATE ON public.default_list_subsection_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. PRODUCT -> (SECTION, SUBSECTION) ASSIGNMENTS
CREATE TABLE public.product_default_sections (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 2),
  section_id uuid NOT NULL REFERENCES public.default_list_sections(id) ON DELETE CASCADE,
  subsection_id uuid REFERENCES public.default_list_subsections(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, position)
);
CREATE INDEX idx_pds_section ON public.product_default_sections(section_id);
CREATE INDEX idx_pds_subsection ON public.product_default_sections(subsection_id);
GRANT SELECT ON public.product_default_sections TO anon, authenticated;
GRANT ALL ON public.product_default_sections TO service_role, authenticated;
ALTER TABLE public.product_default_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_pds" ON public.product_default_sections FOR SELECT USING (true);
CREATE POLICY "admin_write_pds" ON public.product_default_sections FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 4. Validation trigger: subsection must belong to section
CREATE OR REPLACE FUNCTION public.validate_pds_subsection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_section uuid;
BEGIN
  IF NEW.subsection_id IS NOT NULL THEN
    SELECT section_id INTO v_section FROM public.default_list_subsections WHERE id = NEW.subsection_id;
    IF v_section IS DISTINCT FROM NEW.section_id THEN
      RAISE EXCEPTION 'SUBSECTION_NOT_IN_SECTION';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pds_validate BEFORE INSERT OR UPDATE ON public.product_default_sections
  FOR EACH ROW EXECUTE FUNCTION public.validate_pds_subsection();

-- 5. Keep products.default_section_id synced with position=0
CREATE OR REPLACE FUNCTION public.sync_product_default_section_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid; v_new uuid;
BEGIN
  v_pid := COALESCE(NEW.product_id, OLD.product_id);
  SELECT section_id INTO v_new FROM public.product_default_sections
    WHERE product_id = v_pid ORDER BY position ASC LIMIT 1;
  UPDATE public.products SET default_section_id = v_new WHERE id = v_pid;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_pds_sync AFTER INSERT OR UPDATE OR DELETE ON public.product_default_sections
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_default_section_id();

-- 6. Backfill from existing products.default_section_id
INSERT INTO public.product_default_sections (product_id, position, section_id)
SELECT id, 0, default_section_id FROM public.products WHERE default_section_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 7. Seed subsections (CA + ES) for the 9 existing families
DO $seed$
DECLARE
  s_id uuid;
  ord int;
  rec record;
  data jsonb := '[
    {"section_slug":"higiene-personal","items":[
      ["banyera","Banyera","Bañera"],["hamaca-bany","Hamaca de bany","Hamaca de baño"],
      ["seient-bany","Seient de bany","Asiento de baño"],["sabo-bany","Sabó de bany","Jabón de baño"],
      ["crema-corporal","Crema corporal","Crema corporal"],["crema-balsamica","Crema balsàmica","Crema balsámica"],
      ["colonia","Colònia","Colonia"],["pinte-raspall","Pinte / Raspall","Peine / Cepillo"],
      ["esponja-natural","Esponja natural","Esponja natural"],["tisores-tallaungles","Tisores / Tallaungles","Tijeras / Cortauñas"],
      ["llima-ungles","Llima d''ungles","Lima de uñas"],["termometre-bany","Termòmetre de bany","Termómetro de baño"],
      ["aspirador-nasal","Aspirador nasal","Aspirador nasal"],["contenidor-bolquers","Contenidor de bolquers","Contenedor de pañales"],
      ["orinal","Orinal","Orinal"],["tovalloles","Tovalloles","Toallas"],["termometre","Termòmetre","Termómetro"]
    ]},
    {"section_slug":"dormir","items":[
      ["collit","Collit","Cuna pequeña"],["llit-baranes","Llit de baranes","Cuna con barandas"],
      ["matalas","Matalàs","Colchón"],["llencols","Llençols","Sábanas"],["protector-matalas","Protector matalàs","Protector de colchón"],
      ["edredo-sac-nordic","Edredó o sac nòrdic","Edredón o saco nórdico"],["sac-dormir","Sac de dormir","Saco de dormir"],
      ["protector-baranes","Protector de baranes","Protector de barandas"],["mantes","Mantes","Mantas"],
      ["coixi-antivolcada","Coixí antivolcada","Cojín antivuelco"],["camera-vigilancia","Càmera vigilància","Cámara vigilancia"],
      ["punt-llum","Punt de llum","Punto de luz"],["humidificador","Humidificador","Humidificador"],
      ["canviador","Canviador","Cambiador"],["funda-canviador","Funda canviador","Funda cambiador"],
      ["doudou","Doudou","Doudou"],["mussolines","Mussolines","Muselinas"]
    ]},
    {"section_slug":"alimentacio","items":[
      ["biberons","Biberons","Biberones"],["dosificador-llet","Dosificador de llet","Dosificador de leche"],
      ["esterilitzador","Esterilitzador","Esterilizador"],["xumet","Xumet","Chupete"],
      ["cadena-xumet","Cadena xumet","Cadena chupete"],["cullera-silicona","Cullera silicona","Cuchara silicona"],
      ["vaixella","Vaixella","Vajilla"],["escombreta-biberons","Escombreta biberons","Escobilla biberones"],
      ["escalfa-biberons","Escalfa biberons","Calienta biberones"],["robot-cuina","Robot de cuina","Robot de cocina"],
      ["extractor-llet","Extractor de llet","Extractor de leche"],["coixi-lactancia","Coixí de lactància","Cojín de lactancia"],
      ["pots-congelar-llet","Pots congelar llet","Botes congelar leche"],["discos-absorbents","Discos absorbents","Discos absorbentes"],
      ["termo-liquids","Termo de líquids","Termo de líquidos"],["termo-solids","Termo de sòlids","Termo de sólidos"],
      ["pitets","Pitets","Baberos"],["tassa-evolutiva","Tassa evolutiva","Taza evolutiva"],
      ["bossa-isotermica","Bossa isotèrmica","Bolsa isotérmica"],["pitet-baves","Pitet baves","Babero babas"]
    ]},
    {"section_slug":"passeig","items":[
      ["cotxet","Cotxet","Cochecito"],["cadira-passeig","Cadira de passeig","Silla de paseo"],
      ["colxoneta-cadira","Colxoneta cadira","Colchoneta silla"],["sac-cadira","Sac cadira","Saco silla"],
      ["bossa-cotxet","Bossa cotxet","Bolsa cochecito"],["para-sol","Para-sol","Parasol"],
      ["motxilla-porteig","Motxilla de porteig","Mochila de porteo"],["llit-viatge","Llit de viatge","Cuna de viaje"],
      ["alcador","Alçador","Alzador"],["manyoples","Manyoples","Manoplas"],
      ["canviador-portatil","Canviador portàtil","Cambiador portátil"]
    ]},
    {"section_slug":"per-a-casa","items":[
      ["trona","Trona","Trona"],["hamaca","Hamaca","Hamaca"],["caminador","Caminador","Andador"],
      ["parc","Parc","Parque"],["manta-activitats","Manta d''activitats","Manta de actividades"],
      ["mossegadors","Mossegadors","Mordedores"],["joguines","Joguines","Juguetes"],
      ["barrera-portes","Barrera per portes","Barrera para puertas"]
    ]},
    {"section_slug":"cotxe","items":[
      ["cadireta-cotxe","Cadireta de cotxe","Silla de coche"],["funda-cadireta","Funda cadireta","Funda sillita"],
      ["protector-seient","Protector seient","Protector asiento"],["joc-para-sol","Joc de para-sol","Juego de parasol"],
      ["mirall-retrovisor","Mirall retrovisor","Espejo retrovisor"]
    ]},
    {"section_slug":"mare-hospital","items":[
      ["bossa-maternitat","Bossa maternitat","Bolsa maternidad"],["calces-sol-us","Calces d''un sol ús","Bragas de un solo uso"],
      ["sostenidor-lactancia","Sostenidor de lactància","Sujetador de lactancia"],["necesser","Necesser","Neceser"],
      ["organitzador-documents","Organitzador de documents","Organizador de documentos"]
    ]},
    {"section_slug":"bebe-hospital","items":[
      ["conjunts-naixement","3 Conjunts de naixement","3 Conjuntos de nacimiento"],
      ["peca-abric","1 Peça d''abric","1 Prenda de abrigo"],["bodies","4 Bodies","4 Bodies"],
      ["gorro","Gorro","Gorro"],["embolcall","Embolcall","Envoltura"]
    ]},
    {"section_slug":"espera-hospital","items":[
      ["roba-premama","Roba premamà","Ropa premamá"],["oli-corporal","Oli corporal","Aceite corporal"],
      ["cinturo-seguretat-cotxe","Cinturó seguretat cotxe","Cinturón seguridad coche"],
      ["crida-angels","Crida àngels","Llama ángeles"],["coixi-dormir","Coixí de dormir","Cojín de dormir"]
    ]}
  ]'::jsonb;
  section jsonb;
  item jsonb;
  new_id uuid;
BEGIN
  FOR section IN SELECT * FROM jsonb_array_elements(data) LOOP
    SELECT id INTO s_id FROM public.default_list_sections WHERE slug = section->>'section_slug';
    IF s_id IS NULL THEN CONTINUE; END IF;
    ord := 0;
    FOR item IN SELECT * FROM jsonb_array_elements(section->'items') LOOP
      INSERT INTO public.default_list_subsections (section_id, slug, sort_order)
      VALUES (s_id, item->>0, ord)
      ON CONFLICT (section_id, slug) DO UPDATE SET sort_order = EXCLUDED.sort_order
      RETURNING id INTO new_id;
      INSERT INTO public.default_list_subsection_translations (subsection_id, language, name)
      VALUES (new_id, 'ca', item->>1), (new_id, 'es', item->>2)
      ON CONFLICT (subsection_id, language) DO UPDATE SET name = EXCLUDED.name;
      ord := ord + 1;
    END LOOP;
  END LOOP;
END $seed$;
