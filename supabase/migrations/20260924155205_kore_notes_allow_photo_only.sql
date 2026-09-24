-- Una nota del Corcho puede ser solo foto. addCorchoNote inserta kore_notes
-- antes que las filas de kore_note_images, así que el CHECK note_has_content
-- (content o audio_url) rechazaba ese insert. El texto, el audio o al menos
-- una foto se comprueban en addCorchoNote. Ya aplicada en producción
-- (versión 20260924155205).

ALTER TABLE public.kore_notes DROP CONSTRAINT IF EXISTS note_has_content;

COMMENT ON TABLE public.kore_notes IS 'Corcho notes. A note has text, audio or at least one row in kore_note_images; validated in addCorchoNote.';
