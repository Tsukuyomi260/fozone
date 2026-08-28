-- ============================================
-- 012 - Membres d'equipe: plusieurs comptes sur les memes donnees
-- ============================================
-- Un promoteur peut donner acces a un associe. Celui-ci se connecte avec
-- son propre email et son propre mot de passe, mais travaille sur les zones,
-- tickets, tarifs et comptabilite du promoteur qui l'a invite. Le solde est
-- commun: c'est l'argent de l'activite, pas de la personne.
--
-- A ne pas confondre avec le multi-tenant: un membre n'est PAS un promoteur
-- de plus. Il n'a pas ses propres zones, il partage celles d'un autre.
--
-- Choix: table de liaison plutot qu'une colonne sur users. Un compte peut
-- ainsi etre proprietaire de ses zones ET membre chez quelqu'un d'autre,
-- sans que l'un empeche l'autre.

BEGIN;

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Le promoteur dont on partage les donnees
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Le compte invite
    member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Un compte n'est membre que d'UNE seule equipe. Autoriser plusieurs
    -- rattachements rendrait ambigu le "proprietaire effectif" resolu a
    -- chaque requete: on ne saurait pas quelles donnees afficher.
    CONSTRAINT team_members_one_team UNIQUE (member_id),

    -- Se prendre soi-meme comme membre n'a aucun sens et casserait la
    -- resolution du proprietaire effectif
    CONSTRAINT team_members_not_self CHECK (owner_id <> member_id)
);

-- Resolution du proprietaire effectif a chaque requete authentifiee:
-- "de qui suis-je membre ?"
CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_id);

-- Liste de l'equipe d'un promoteur
CREATE INDEX IF NOT EXISTS idx_team_members_owner ON team_members(owner_id);

COMMIT;

-- Verification
-- SELECT o.email AS proprietaire, m.email AS membre, tm.created_at
-- FROM team_members tm
-- JOIN users o ON o.id = tm.owner_id
-- JOIN users m ON m.id = tm.member_id;
