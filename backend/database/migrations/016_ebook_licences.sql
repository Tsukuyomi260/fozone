-- ============================================
-- 016 - Licences du guide « Lancer sa Wi-Fi Zone »
-- ============================================
-- Le guide etait servi par une seule adresse publique, partagee a tous les
-- acheteurs. Un lien se transfere: certains revendaient l'acces.
--
-- Chaque acheteur recoit desormais son propre exemplaire, marque a son nom et
-- a son numero sur chaque page, servi par une adresse qui lui est propre. Le
-- fichier vit dans un bucket Supabase prive: il n'est jamais accessible
-- directement, seulement a travers la route qui verifie le jeton.
--
-- Cette table est la fondation du verrou a venir (mot de passe choisi par
-- l'acheteur, nombre d'appareils limite): ces colonnes viendront s'y ajouter
-- sans rien casser de ce qui est pose ici.

BEGIN;

CREATE TABLE IF NOT EXISTS ebook_licences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identite du titulaire, telle qu'imprimee en filigrane sur l'exemplaire.
    -- Elle vient de la commande, jamais d'une saisie de l'acheteur.
    reference VARCHAR(40) UNIQUE,
    prenom VARCHAR(120),
    nom VARCHAR(120) NOT NULL,
    telephone VARCHAR(40),

    -- Le jeton est la seule chose qui circule. 32 octets en hexadecimal:
    -- personne ne le devine, et il ne laisse rien deviner des autres.
    jeton VARCHAR(128) NOT NULL UNIQUE,

    -- Chemin du fichier dans le bucket prive, bucket compris.
    chemin_storage TEXT NOT NULL,

    -- Un lien qui fuit se coupe ici, sans toucher aux autres.
    revoquee BOOLEAN NOT NULL DEFAULT FALSE,
    revoquee_le TIMESTAMPTZ,
    motif_revocation TEXT,

    -- NULL = pas de date de fin.
    expire_le TIMESTAMPTZ,

    -- De quoi reperer un lien qui circule: un exemplaire ouvert cent fois
    -- depuis des adresses differentes n'est plus lu par son seul titulaire.
    ouvertures INTEGER NOT NULL DEFAULT 0,
    premiere_ouverture TIMESTAMPTZ,
    derniere_ouverture TIMESTAMPTZ,
    derniere_ip VARCHAR(64),

    cree_le TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chaque ouverture du guide passe par une recherche sur le jeton.
CREATE INDEX IF NOT EXISTS idx_ebook_licences_jeton ON ebook_licences(jeton);

-- Retrouver un acheteur quand il ecrit « j'ai perdu mon lien ».
CREATE INDEX IF NOT EXISTS idx_ebook_licences_telephone ON ebook_licences(telephone);
CREATE INDEX IF NOT EXISTS idx_ebook_licences_cree_le ON ebook_licences(cree_le DESC);

COMMENT ON TABLE ebook_licences IS
    'Un exemplaire nominatif du guide par acheteur. Le jeton est la clef d''acces, le filigrane la preuve.';

COMMIT;
