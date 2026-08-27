-- ============================================
-- 011 - Demandes de retrait des promoteurs
-- ============================================
-- Fo-Zone encaisse via son propre compte agregateur et tient un solde par
-- promoteur. Le promoteur demande un retrait, le super-admin valide et
-- effectue le virement Mobile Money a la main, puis marque la ligne payee.
--
-- Le solde n'est JAMAIS stocke. Il est toujours derive:
--   somme(net_to_tenant des paiements completed)
--   - somme(retraits en statut 'approved' ou 'paid')
--
-- Un solde stocke derive un jour (double credit, crash entre deux ecritures,
-- rejeu de webhook). Un solde derive ne peut pas desynchroniser de la verite.
-- Les retraits 'approved' (valides, virement pas encore confirme) sont deja
-- deduits, sinon le promoteur pourrait demander deux fois les memes fonds.

BEGIN;

CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Le promoteur qui demande. CASCADE: si le compte disparait, ses
    -- demandes n'ont plus d'objet.
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),

    -- Numero Mobile Money sur lequel envoyer les fonds, saisi a la demande.
    -- Fige ici plutot que lu depuis users.phone: le promoteur peut changer
    -- son numero de profil apres coup, la trace du virement doit rester
    -- celle du moment de la demande.
    payout_phone VARCHAR(20) NOT NULL,

    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,

    -- Quel super-admin a traite la demande. SET NULL: on garde la trace de
    -- l'operation meme si le compte administrateur est supprime plus tard.
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Motif de refus, ou reference du virement une fois paye
    note TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Calcul du solde: filtre sur (owner_id, status)
CREATE INDEX IF NOT EXISTS idx_withdrawals_owner_status ON withdrawals(owner_id, status);

-- File d'attente du super-admin: les demandes en attente, les plus anciennes
-- d'abord
CREATE INDEX IF NOT EXISTS idx_withdrawals_status_requested ON withdrawals(status, requested_at);

-- Meme declencheur updated_at que les autres tables (defini dans schema.sql)
DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON withdrawals;
CREATE TRIGGER update_withdrawals_updated_at
    BEFORE UPDATE ON withdrawals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Verification
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'withdrawals' ORDER BY ordinal_position;
