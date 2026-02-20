-- ============================================================
-- Migration 002: Bucket Storage pour les photos de profil
-- ============================================================

-- ── Création du bucket "avatars" (public) ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,                          -- 5 Mo max
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ── Policies Storage ──

-- Lecture publique (pour afficher les avatars sans authentification)
DROP POLICY IF EXISTS "Avatars accessibles publiquement" ON storage.objects;
CREATE POLICY "Avatars accessibles publiquement"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Upload : un utilisateur ne peut uploader que son propre avatar
-- Le fichier est stocké sous la forme "<user_id>.webp"
DROP POLICY IF EXISTS "Upload de son propre avatar" ON storage.objects;
CREATE POLICY "Upload de son propre avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND name = auth.uid()::text || '.webp'
  );

-- Mise à jour (upsert) : idem, uniquement son propre fichier
DROP POLICY IF EXISTS "Mise à jour de son propre avatar" ON storage.objects;
CREATE POLICY "Mise à jour de son propre avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name = auth.uid()::text || '.webp'
  );

-- Suppression : idem
DROP POLICY IF EXISTS "Suppression de son propre avatar" ON storage.objects;
CREATE POLICY "Suppression de son propre avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name = auth.uid()::text || '.webp'
  );
