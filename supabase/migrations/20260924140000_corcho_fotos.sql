-- Corcho: fotos privadas por familia.
-- NO está aplicada en producción. Ejecutar en el SQL editor del proyecto
-- tcpypvekblrbsldhgfrn (o `supabase db push`) en el momento del merge.
--
-- kore_notes ya tiene la policy family_isolation (family_id = get_my_family_id()).
-- Esta tabla sigue esa misma regla. No se copia allow_all: esa policy permisiva
-- de kore_notes deja la tabla abierta y no debe extenderse a las fotos.

CREATE TABLE IF NOT EXISTS public.kore_note_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.kore_notes(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kore_note_images_storage_path_unique UNIQUE (storage_path),
  CONSTRAINT kore_note_images_path_matches_note CHECK (
    split_part(storage_path, '/', 1) = family_id::text
    AND split_part(storage_path, '/', 2) = note_id::text
    AND storage_path LIKE '%.jpg'
  )
);

CREATE INDEX IF NOT EXISTS idx_kore_note_images_note
  ON public.kore_note_images (note_id);

CREATE INDEX IF NOT EXISTS idx_kore_note_images_family
  ON public.kore_note_images (family_id);

ALTER TABLE public.kore_note_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_isolation ON public.kore_note_images;
CREATE POLICY family_isolation ON public.kore_note_images
  FOR ALL
  USING (family_id = public.get_my_family_id())
  WITH CHECK (family_id = public.get_my_family_id());

REVOKE ALL ON public.kore_note_images FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kore_note_images TO authenticated;
GRANT ALL ON public.kore_note_images TO service_role;

-- Bucket privado. Las fotos se sirven con URL firmada, no con URL pública.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'corcho-fotos',
  'corcho-fotos',
  false,
  2097152,
  ARRAY['image/jpeg']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Ruta: {family_id}/{note_id}/{image_id}.jpg
-- Upsert exige SELECT + INSERT + UPDATE; el borrado de la nota exige DELETE.

DROP POLICY IF EXISTS corcho_fotos_select ON storage.objects;
CREATE POLICY corcho_fotos_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'corcho-fotos'
    AND (storage.foldername(name))[1] = public.get_my_family_id()::text
  );

DROP POLICY IF EXISTS corcho_fotos_insert ON storage.objects;
CREATE POLICY corcho_fotos_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'corcho-fotos'
    AND (storage.foldername(name))[1] = public.get_my_family_id()::text
  );

DROP POLICY IF EXISTS corcho_fotos_update ON storage.objects;
CREATE POLICY corcho_fotos_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'corcho-fotos'
    AND (storage.foldername(name))[1] = public.get_my_family_id()::text
  )
  WITH CHECK (
    bucket_id = 'corcho-fotos'
    AND (storage.foldername(name))[1] = public.get_my_family_id()::text
  );

DROP POLICY IF EXISTS corcho_fotos_delete ON storage.objects;
CREATE POLICY corcho_fotos_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'corcho-fotos'
    AND (storage.foldername(name))[1] = public.get_my_family_id()::text
  );
