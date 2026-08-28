/**
 * Administration de la plateforme. Reserve au compte super-admin, qui ne
 * possede aucune zone: il ne vend rien, il valide les retraits et surveille
 * l'activite des promoteurs.
 */

const { supabaseAdmin } = require('../config/database');
const { getBalance } = require('../utils/balance');
const { commissionOn } = require('../config/commission');
const logger = require('../config/logger');

/**
 * Liste des promoteurs avec leur activite et leur solde
 */
async function getTenants(req, res, next) {
  try {
    // Les membres d'equipe ne sont pas des promoteurs: ils partagent les
    // donnees de celui qui les a invites. Les lister ici les ferait
    // apparaitre comme de faux tenants a zero zone et zero vente.
    const { data: memberships } = await supabaseAdmin
      .from('team_members')
      .select('member_id');

    const memberIds = (memberships || []).map((m) => m.member_id);

    // Le super-admin lui-meme n'est pas un promoteur: il n'a ni zone ni solde
    let query = supabaseAdmin
      .from('users')
      .select('id, email, full_name, phone, role, is_active, created_at')
      .neq('role', 'super_admin')
      .order('created_at', { ascending: false });

    if (memberIds.length > 0) {
      query = query.not('id', 'in', `(${memberIds.join(',')})`);
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      logger.error('Error loading tenants:', usersError);
      return res.status(500).json({
        error: 'Failed to load tenants',
        details: usersError.message
      });
    }

    const tenants = await Promise.all(
      (users || []).map(async (user) => {
        const [{ count: zoneCount }, { data: payments }, balance] = await Promise.all([
          supabaseAdmin
            .from('wifi_zones')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', user.id),
          supabaseAdmin
            .from('payments')
            .select('amount, platform_fee')
            .eq('owner_id', user.id)
            .eq('status', 'completed'),
          getBalance(user.id)
        ]);

        const gross = (payments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const platformFees = (payments || []).reduce(
          (s, p) => s + parseFloat(p.platform_fee || 0),
          0
        );
        // Ce que la plateforme garde vraiment: sa commission moins ce que
        // l'agregateur lui prend. Calcule par ligne, comme partout ailleurs.
        const aggregatorFees = (payments || []).reduce(
          (s, p) => s + commissionOn(p.amount),
          0
        );

        return {
          ...user,
          zones: zoneCount || 0,
          sales_count: (payments || []).length,
          gross_volume: gross,
          platform_fees: platformFees,
          platform_margin: platformFees - aggregatorFees,
          balance
        };
      })
    );

    res.json({ tenants });
  } catch (error) {
    next(error);
  }
}

/**
 * Demandes de retrait, toutes ou filtrees par statut
 */
async function getWithdrawals(req, res, next) {
  try {
    const { status } = req.query;

    let query = supabaseAdmin
      .from('withdrawals')
      .select('*, users!withdrawals_owner_id_fkey(email, full_name)')
      .order('requested_at', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: withdrawals, error } = await query;

    if (error) {
      logger.error('Error loading withdrawals:', error);
      return res.status(500).json({
        error: 'Failed to load withdrawals',
        details: error.message
      });
    }

    res.json({ withdrawals: withdrawals || [] });
  } catch (error) {
    next(error);
  }
}

/**
 * Change le statut d'une demande.
 * Fabrique commune aux trois transitions: approve, paid, reject.
 */
function transition(targetStatus, allowedFrom, successMessage) {
  return async function (req, res, next) {
    try {
      const { id } = req.params;
      const { note } = req.body || {};

      const { data: withdrawal, error: loadError } = await supabaseAdmin
        .from('withdrawals')
        .select('*')
        .eq('id', id)
        .single();

      if (loadError || !withdrawal) {
        return res.status(404).json({ error: 'Withdrawal not found' });
      }

      if (!allowedFrom.includes(withdrawal.status)) {
        return res.status(400).json({
          error: `Transition impossible depuis le statut « ${withdrawal.status} »`,
          current: withdrawal.status,
          expected: allowedFrom
        });
      }

      // A la validation seulement: le solde a pu bouger depuis la demande
      // (autre retrait valide entre-temps). On revalide avant d'engager.
      if (targetStatus === 'approved') {
        const balance = await getBalance(withdrawal.owner_id);
        if (parseFloat(withdrawal.amount) > balance.available) {
          return res.status(400).json({
            error: 'Solde insuffisant pour valider ce retrait',
            available: balance.available,
            requested: parseFloat(withdrawal.amount)
          });
        }
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('withdrawals')
        .update({
          status: targetStatus,
          processed_at: new Date().toISOString(),
          processed_by: req.user.id,
          ...(note !== undefined ? { note } : {})
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        logger.error('Error updating withdrawal:', updateError);
        return res.status(400).json({
          error: 'Failed to update withdrawal',
          details: updateError.message
        });
      }

      logger.info(
        `Withdrawal ${id} -> ${targetStatus} by ${req.user.id} (${withdrawal.amount} XOF)`
      );

      res.json({ message: successMessage, withdrawal: updated });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Active ou desactive un compte promoteur.
 * Un compte inactif ne peut ni se connecter ni vendre: le middleware le
 * rejette a chaque requete, et son jeton eventuel devient inutilisable.
 */
async function setTenantActive(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const { data: target, error: loadError } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('id', id)
      .single();

    if (loadError || !target) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Garde-fou: la plateforme ne doit pas pouvoir se desactiver elle-meme
    // et se verrouiller dehors.
    if (target.role === 'super_admin') {
      return res.status(400).json({
        error: 'Impossible de modifier un compte plateforme'
      });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('users')
      .update({ is_active: Boolean(is_active) })
      .eq('id', id)
      .select('id, email, full_name, role, is_active')
      .single();

    if (error) {
      logger.error('Error updating tenant:', error);
      return res.status(400).json({
        error: 'Failed to update tenant',
        details: error.message
      });
    }

    logger.info(
      `Tenant ${target.email} ${is_active ? 'activated' : 'deactivated'} by ${req.user.id}`
    );

    res.json({
      message: is_active ? 'Promoteur activé' : 'Promoteur désactivé',
      tenant: updated
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTenants,
  setTenantActive,
  getWithdrawals,
  approveWithdrawal: transition('approved', ['pending'], 'Retrait validé'),
  markWithdrawalPaid: transition('paid', ['approved'], 'Retrait marqué comme payé'),
  rejectWithdrawal: transition('rejected', ['pending', 'approved'], 'Retrait refusé')
};
