
-- 1) Backfill country to 'ES' where null/empty
UPDATE public.profiles
   SET country = 'ES'
 WHERE country IS NULL OR btrim(country) = '';

UPDATE public.customers
   SET country = 'ES'
 WHERE country IS NULL OR btrim(country) = '';

-- 2) Helper to map Spanish 2-digit postal code prefix to province label
CREATE OR REPLACE FUNCTION public._province_from_es_postal(_postal text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE substring(regexp_replace(coalesce(_postal,''), '\D', '', 'g') FROM 1 FOR 2)
    WHEN '01' THEN 'Àlaba / Álava'
    WHEN '02' THEN 'Albacete'
    WHEN '03' THEN 'Alacant / Alicante'
    WHEN '04' THEN 'Almeria / Almería'
    WHEN '05' THEN 'Àvila / Ávila'
    WHEN '06' THEN 'Badajoz'
    WHEN '07' THEN 'Illes Balears'
    WHEN '08' THEN 'Barcelona'
    WHEN '09' THEN 'Burgos'
    WHEN '10' THEN 'Càceres / Cáceres'
    WHEN '11' THEN 'Cadis / Cádiz'
    WHEN '12' THEN 'Castelló / Castellón'
    WHEN '13' THEN 'Ciudad Real'
    WHEN '14' THEN 'Còrdova / Córdoba'
    WHEN '15' THEN 'A Coruña'
    WHEN '16' THEN 'Conca / Cuenca'
    WHEN '17' THEN 'Girona'
    WHEN '18' THEN 'Granada'
    WHEN '19' THEN 'Guadalajara'
    WHEN '20' THEN 'Guipúscoa / Gipuzkoa'
    WHEN '21' THEN 'Huelva'
    WHEN '22' THEN 'Osca / Huesca'
    WHEN '23' THEN 'Jaén'
    WHEN '24' THEN 'Lleó / León'
    WHEN '25' THEN 'Lleida'
    WHEN '26' THEN 'La Rioja'
    WHEN '27' THEN 'Lugo'
    WHEN '28' THEN 'Madrid'
    WHEN '29' THEN 'Màlaga / Málaga'
    WHEN '30' THEN 'Múrcia / Murcia'
    WHEN '31' THEN 'Navarra'
    WHEN '32' THEN 'Ourense'
    WHEN '33' THEN 'Astúries / Asturias'
    WHEN '34' THEN 'Palència / Palencia'
    WHEN '35' THEN 'Las Palmas'
    WHEN '36' THEN 'Pontevedra'
    WHEN '37' THEN 'Salamanca'
    WHEN '38' THEN 'Santa Cruz de Tenerife'
    WHEN '39' THEN 'Cantàbria / Cantabria'
    WHEN '40' THEN 'Segòvia / Segovia'
    WHEN '41' THEN 'Sevilla'
    WHEN '42' THEN 'Sòria / Soria'
    WHEN '43' THEN 'Tarragona'
    WHEN '44' THEN 'Terol / Teruel'
    WHEN '45' THEN 'Toledo'
    WHEN '46' THEN 'València / Valencia'
    WHEN '47' THEN 'Valladolid'
    WHEN '48' THEN 'Biscaia / Bizkaia'
    WHEN '49' THEN 'Zamora'
    WHEN '50' THEN 'Saragossa / Zaragoza'
    WHEN '51' THEN 'Ceuta'
    WHEN '52' THEN 'Melilla'
    ELSE NULL
  END
$$;

-- 3) Backfill province for ES rows from postal_code where possible
UPDATE public.profiles
   SET province = public._province_from_es_postal(postal_code)
 WHERE (province IS NULL OR btrim(province) = '')
   AND country = 'ES'
   AND postal_code IS NOT NULL
   AND public._province_from_es_postal(postal_code) IS NOT NULL;

UPDATE public.customers
   SET province = public._province_from_es_postal(postal_code)
 WHERE (province IS NULL OR btrim(province) = '')
   AND country = 'ES'
   AND postal_code IS NOT NULL
   AND public._province_from_es_postal(postal_code) IS NOT NULL;

-- 4) Normalize empty strings to NULL for consistency
UPDATE public.profiles  SET province = NULL WHERE province IS NOT NULL AND btrim(province) = '';
UPDATE public.customers SET province = NULL WHERE province IS NOT NULL AND btrim(province) = '';

-- Drop helper (one-shot migration)
DROP FUNCTION public._province_from_es_postal(text);
