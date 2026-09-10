/**
 * Gestionnaire de tickets
 * Gère l'attribution atomique des tickets avec transactions
 */

const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');

/**
 * Attribue un ticket de manière atomique pour un paiement.
 *
 * Le ticket doit appartenir au tarif payé: un achat de 100 F ne peut pas
 * sortir un ticket d'un mois. Sans ticket du bon tarif, l'attribution échoue
 * plutôt que de livrer un ticket plus cher (migration 015b).
 *
 * @param {string} wifiZoneId - ID de la zone Wi-Fi
 * @param {string} paymentId - ID du paiement confirmé
 * @param {string} pricingId - Tarif payé par le client
 * @returns {Promise<{success: boolean, ticket: object|null, error: string|null}>}
 */
async function assignTicketAtomically(wifiZoneId, paymentId, pricingId) {
  if (!pricingId) {
    // Sans tarif, impossible de savoir quel ticket livrer.
    return {
      success: false,
      ticket: null,
      error: 'Payment has no pricing: cannot pick a ticket'
    };
  }

  try {
    // Utiliser une transaction PostgreSQL via Supabase
    // RPC (Remote Procedure Call) pour exécuter une fonction SQL atomique
    
    const { data, error } = await supabaseAdmin.rpc('assign_ticket_atomic', {
      p_wifi_zone_id: wifiZoneId,
      p_payment_id: paymentId,
      p_pricing_id: pricingId
    });

    if (error) {
      logger.error('Error in atomic ticket assignment:', error);
      return {
        success: false,
        ticket: null,
        error: error.message
      };
    }

    // La fonction SQL est declaree RETURNS TABLE: PostgREST renvoie donc un
    // tableau de lignes. L'ancien code lisait data.ticket_id sur ce tableau,
    // toujours undefined: chaque vente reussie etait comptee comme un echec,
    // journalisait « PAYMENT WITHOUT TICKET » et renvoyait 500 a Moneroo, qui
    // rejouait le webhook. Le ticket, lui, etait bien attribue.
    const row = Array.isArray(data) ? data[0] : data;
    const assignedId = row?.ticket_id;

    if (!assignedId) {
      return {
        success: false,
        ticket: null,
        error: 'No available ticket for this pricing'
      };
    }

    // Récupérer les détails du ticket assigné
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('id', assignedId)
      .single();

    if (ticketError) {
      logger.error('Error fetching assigned ticket:', ticketError);
      return {
        success: false,
        ticket: null,
        error: ticketError.message
      };
    }

    logger.info(`Ticket ${ticket.id} assigned to payment ${paymentId}`);
    
    return {
      success: true,
      ticket: ticket,
      error: null
    };
  } catch (error) {
    logger.error('Unexpected error in ticket assignment:', error);
    return {
      success: false,
      ticket: null,
      error: error.message
    };
  }
}

/**
 * Récupère les statistiques de tickets pour une zone Wi-Fi
 * @param {string} wifiZoneId - ID de la zone Wi-Fi
 * @returns {Promise<object>}
 */
async function getTicketStats(wifiZoneId) {
  try {
    const [{ data, error }, { data: pricings }] = await Promise.all([
      supabaseAdmin
        .from('tickets')
        .select('status, profile, pricing_id')
        .eq('wifi_zone_id', wifiZoneId),
      supabaseAdmin
        .from('pricings')
        .select('id, name, amount, is_active')
        .eq('wifi_zone_id', wifiZoneId)
    ]);

    if (error) throw error;

    const free = data.filter((t) => t.status === 'free');

    // Stock par tarif: un total de tickets libres ne dit rien si tous
    // appartiennent au meme forfait pendant qu'un autre est en rupture.
    const freeByPricing = {};
    free.forEach((t) => {
      if (t.pricing_id) freeByPricing[t.pricing_id] = (freeByPricing[t.pricing_id] || 0) + 1;
    });

    // Tickets libres sans tarif: invendables tant que le promoteur n'a pas
    // rattache leur profil a un forfait.
    const unlinkedByProfile = {};
    free.forEach((t) => {
      if (!t.pricing_id) {
        const key = t.profile || 'sans profil';
        unlinkedByProfile[key] = (unlinkedByProfile[key] || 0) + 1;
      }
    });

    const stats = {
      total: data.length,
      free: free.length,
      sold: data.filter(t => t.status === 'sold').length,
      reserved: data.filter(t => t.status === 'reserved').length,
      expired: data.filter(t => t.status === 'expired').length,
      by_pricing: (pricings || []).map((p) => ({
        pricing_id: p.id,
        name: p.name,
        amount: parseFloat(p.amount),
        is_active: p.is_active,
        free: freeByPricing[p.id] || 0
      })),
      unlinked: Object.entries(unlinkedByProfile).map(([profile, count]) => ({
        profile,
        count
      }))
    };

    return stats;
  } catch (error) {
    logger.error('Error getting ticket stats:', error);
    throw error;
  }
}

module.exports = {
  assignTicketAtomically,
  getTicketStats
};

