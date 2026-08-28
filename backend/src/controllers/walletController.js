/**
 * Solde et demandes de retrait, cote promoteur.
 * Chaque promoteur ne voit et ne demande que sur son propre solde.
 */

const { supabaseAdmin } = require('../config/database');
const { getBalance } = require('../utils/balance');
const logger = require('../config/logger');

/**
 * Solde du promoteur connecte
 */
async function getWalletBalance(req, res, next) {
  try {
    const balance = await getBalance(req.user.ownerId);
    res.json({ balance });
  } catch (error) {
    logger.error('Error computing balance:', { userId: req.user.id, error: error.message });
    next(error);
  }
}

/**
 * Historique des demandes du promoteur connecte
 */
async function getMyWithdrawals(req, res, next) {
  try {
    const { data: withdrawals, error } = await supabaseAdmin
      .from('withdrawals')
      .select('id, amount, status, payout_phone, requested_at, processed_at, note')
      .eq('owner_id', req.user.ownerId)
      .order('requested_at', { ascending: false });

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
 * Nouvelle demande de retrait
 */
async function requestWithdrawal(req, res, next) {
  try {
    const { amount, payout_phone } = req.body;
    const requested = parseFloat(amount);

    // Le solde est recalcule ici, jamais lu depuis le client: une demande
    // ne peut pas depasser ce que le promoteur a reellement gagne.
    const balance = await getBalance(req.user.ownerId);

    if (requested > balance.available) {
      return res.status(400).json({
        error: 'Solde insuffisant',
        available: balance.available,
        requested
      });
    }

    // Une seule demande en attente a la fois: sinon deux demandes pourraient
    // chacune passer le controle de solde avant que l'autre soit validee.
    const { data: existing } = await supabaseAdmin
      .from('withdrawals')
      .select('id')
      .eq('owner_id', req.user.ownerId)
      .eq('status', 'pending')
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({
        error: 'Une demande de retrait est déjà en attente de validation'
      });
    }

    const digits = String(payout_phone).replace(/\D/g, '');
    const phone = digits.length === 8 ? `229${digits}` : digits;

    const { data: withdrawal, error } = await supabaseAdmin
      .from('withdrawals')
      .insert({
        owner_id: req.user.ownerId,
        amount: requested,
        payout_phone: phone,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating withdrawal:', error);
      return res.status(400).json({
        error: 'Failed to create withdrawal',
        details: error.message
      });
    }

    logger.info(`Withdrawal requested: ${withdrawal.id} by ${req.user.id} for ${requested} XOF`);

    res.status(201).json({
      message: 'Demande de retrait enregistrée',
      withdrawal
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getWalletBalance,
  getMyWithdrawals,
  requestWithdrawal
};
