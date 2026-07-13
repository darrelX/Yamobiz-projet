-- Support de plusieurs entreprises par compte utilisateur.
--
-- `businesses.user_id` n'a jamais eu de contrainte UNIQUE, donc plusieurs
-- lignes par utilisateur étaient déjà possibles côté DB — mais le frontend
-- utilisait `.maybeSingle()`, qui plante dès qu'il y a plus d'une ligne.
-- On ajoute donc une table `profiles` qui retient quelle entreprise est
-- "active" pour l'utilisateur (celle affichée dans le dashboard), et qui
-- sert aussi de point d'ancrage pour les futures infos de profil.

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Un utilisateur existant a forcément déjà une entreprise (créée à
-- l'inscription) : on rétro-remplit un profil pour chacun, avec sa première
-- entreprise comme active, pour que rien ne casse pour les comptes existants.
INSERT INTO profiles (id, active_business_id)
SELECT DISTINCT ON (b.user_id) b.user_id, b.id
FROM businesses b
ORDER BY b.user_id, b.created_at ASC
ON CONFLICT (id) DO NOTHING;
