/**
 * Contrôleur pour la gestion des tickets
 * Gère l'import CSV, la consultation et les statistiques
 */

const csv = require('csv-parser');
const { Readable } = require('stream');
const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');
const { LOW_STOCK_THRESHOLD } = require('../config/stock');

/**
 * Récupère tous les tickets d'une zone Wi-Fi
 */
async function getTicketsByZone(req, res, next) {
  try {
    const { zoneId } = req.params;
    const { status, pricing_id, page = 1, limit = 50 } = req.query;

    // Les parametres arrivent en texte: sans conversion, from + limit - 1
    // concatenait (page 2: 50 + "50" - 1 = 5049 lignes demandees).
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 50, 1);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    // Controle de propriete lance en meme temps que la premiere lecture.
    // Rien n'est renvoye tant que la propriete n'est pas confirmee.
    const zoneCheck = supabaseAdmin
      .from('wifi_zones')
      .select('id')
      .eq('id', zoneId)
      .eq('owner_id', req.user.ownerId)
      .single();

    const notFound = () =>
      res.status(404).json({
        error: 'Wi-Fi zone not found'
      });

    const respond = (tickets, count) =>
      res.json({
        tickets: tickets || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0
        }
      });

    // Sans filtre de tarif: controle et lecture en parallele
    if (!pricing_id) {
      let query = supabaseAdmin
        .from('tickets')
        .select('*')
        .eq('wifi_zone_id', zoneId);

      if (status) {
        query = query.eq('status', status);
      }

      const [{ data: zone }, { data: tickets, error, count }] = await Promise.all([
        zoneCheck,
        query.order('created_at', { ascending: false }).range(from, to)
      ]);

      if (!zone) return notFound();

      if (error) {
        logger.error('Error fetching tickets:', error);
        throw error;
      }

      return respond(tickets, count);
    }

    // Avec filtre de tarif: controle en parallele de la recherche des paiements
    const [{ data: zone }, { data: payments, error: paymentsError }] = await Promise.all([
      zoneCheck,
      supabaseAdmin
        .from('payments')
        .select('id')
        .eq('wifi_zone_id', zoneId)
        .eq('pricing_id', pricing_id)
    ]);

    if (!zone) return notFound();

    if (paymentsError) {
      logger.error('Error fetching payments for pricing filter:', paymentsError);
      throw paymentsError;
    }

    const paymentIds = payments?.map(p => p.id) || [];

    if (paymentIds.length === 0) {
      // Aucun payment avec ce pricing_id, donc aucun ticket
      return respond([], 0);
    }

    let query = supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('wifi_zone_id', zoneId)
      .in('payment_id', paymentIds);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: tickets, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('Error fetching tickets:', error);
      throw error;
    }

    return respond(tickets, count);
  } catch (error) {
    next(error);
  }
}

/**
 * Importe des tickets depuis un fichier CSV
 * Format CSV attendu: username,password,profile
 */
async function importTickets(req, res, next) {
  try {
    const { zoneId } = req.params;
    const { pricing_id } = req.body; // Récupérer pricing_id depuis le body (optionnel)

    if (!req.file) {
      return res.status(400).json({
        error: 'No CSV file provided'
      });
    }

    // Vérifier que la zone appartient à l'utilisateur
    const { data: zone } = await supabaseAdmin
      .from('wifi_zones')
      .select('id')
      .eq('id', zoneId)
      .eq('owner_id', req.user.ownerId)
      .single();

    if (!zone) {
      return res.status(404).json({
        error: 'Wi-Fi zone not found'
      });
    }

    // Un ticket sans tarif n'est plus vendable (migration 015): on determine
    // donc le tarif de chaque ligne avant l'insertion.
    //
    // Priorite au tarif choisi dans le formulaire; sinon correspondance entre
    // la colonne Profile du CSV et le profil declare sur le tarif.
    const { data: zonePricings } = await supabaseAdmin
      .from('pricings')
      .select('id, name, ticket_profile')
      .eq('wifi_zone_id', zoneId);

    let forcedPricingId = null;
    if (pricing_id) {
      const match = (zonePricings || []).find((p) => p.id === pricing_id);
      if (match) {
        forcedPricingId = match.id;
      } else {
        logger.warn(`Pricing ${pricing_id} not found or doesn't belong to zone ${zoneId}`);
      }
    }

    const byProfile = new Map();
    (zonePricings || []).forEach((p) => {
      if (p.ticket_profile) byProfile.set(p.ticket_profile.trim().toLowerCase(), p.id);
    });

    const tickets = [];
    const errors = [];

    // Parser le CSV
    return new Promise((resolve, reject) => {
      const stream = Readable.from(req.file.buffer.toString());

      stream
        .pipe(csv())
        .on('data', (row) => {
          // Le CSV peut avoir différentes colonnes : Username, Password, Profile, Time Limit, Data Limit, Comment
          const username = row.Username || row.username;
          const password = row.Password || row.password;

          if (username && password) {
            const profile = (row.Profile || row.profile || row.profile_name || '').trim() || null;

            const ticketData = {
              wifi_zone_id: zoneId,
              username: username.trim(),
              password: password.trim(),
              profile: profile,
              // Sans tarif, le ticket ne pourra etre vendu par aucun forfait:
              // la reponse d'import le signale au promoteur.
              pricing_id:
                forcedPricingId ||
                (profile ? byProfile.get(profile.toLowerCase()) || null : null),
              status: 'free',
              created_at: new Date().toISOString()
            };

            tickets.push(ticketData);
          } else {
            errors.push(`Invalid row: ${JSON.stringify(row)}`);
          }
        })
        .on('end', async () => {
          try {
            if (tickets.length === 0) {
              return res.status(400).json({
                error: 'No valid tickets found in CSV',
                details: errors
              });
            }

            // Insérer les tickets en batch
            const { data: insertedTickets, error: insertError } = await supabaseAdmin
              .from('tickets')
              .insert(tickets)
              .select();

            if (insertError) {
              logger.error('Error importing tickets:', insertError);
              return res.status(400).json({
                error: 'Failed to import tickets',
                details: insertError.message
              });
            }

            const unlinked = insertedTickets.filter((t) => !t.pricing_id);

            logger.info(
              `Imported ${insertedTickets.length} tickets for zone ${zoneId}` +
              (unlinked.length ? ` (${unlinked.length} sans tarif)` : '')
            );

            res.status(201).json({
              message: 'Tickets imported successfully',
              imported: insertedTickets.length,
              linked: insertedTickets.length - unlinked.length,
              // Un ticket sans tarif ne sera vendu par aucun forfait: le
              // promoteur doit rattacher son profil depuis la page Tickets.
              unlinked: unlinked.length,
              unlinked_profiles: [...new Set(unlinked.map((t) => t.profile || 'sans profil'))],
              errors: errors.length > 0 ? errors : undefined,
              tickets: insertedTickets
            });

            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les statistiques de tickets pour une zone
 */
async function getTicketStats(req, res, next) {
  try {
    const { zoneId } = req.params;
    const { getTicketStats } = require('../utils/ticketManager');

    // Controle de propriete et calcul lances ensemble; les stats ne sortent
    // qu'une fois la propriete confirmee.
    const [{ data: zone }, stats] = await Promise.all([
      supabaseAdmin
        .from('wifi_zones')
        .select('id')
        .eq('id', zoneId)
        .eq('owner_id', req.user.ownerId)
        .single(),
      getTicketStats(zoneId)
    ]);

    if (!zone) {
      return res.status(404).json({
        error: 'Wi-Fi zone not found'
      });
    }

    res.json({
      stats: stats
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime un ticket spécifique
 */
async function deleteTicket(req, res, next) {
  try {
    const { ticketId } = req.params;

    // Récupérer le ticket pour vérifier qu'il existe
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('id, wifi_zone_id, status')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({
        error: 'Ticket not found'
      });
    }

    // Un ticket vendu est la preuve de la vente: la comptabilite le relie au
    // paiement par payment_id. Le supprimer ferait disparaitre les identifiants
    // remis au client.
    if (ticket.status === 'sold') {
      return res.status(409).json({
        error: 'Ce ticket a deja ete vendu et ne peut pas etre supprime.'
      });
    }

    // Vérifier que la zone appartient à l'utilisateur
    const { data: zone, error: zoneError } = await supabaseAdmin
      .from('wifi_zones')
      .select('id, owner_id')
      .eq('id', ticket.wifi_zone_id)
      .eq('owner_id', req.user.ownerId)
      .single();

    if (zoneError || !zone) {
      return res.status(403).json({
        error: 'Access denied. You do not own this ticket\'s zone.'
      });
    }

    // Supprimer le ticket
    const { error: deleteError } = await supabaseAdmin
      .from('tickets')
      .delete()
      .eq('id', ticketId);

    if (deleteError) {
      logger.error('Error deleting ticket:', deleteError);
      throw deleteError;
    }

    logger.info(`Deleted ticket ${ticketId} from zone ${ticket.wifi_zone_id}`);

    res.json({
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime tous les tickets d'une zone Wi-Fi
 */
async function deleteAllTickets(req, res, next) {
  try {
    const { zoneId } = req.params;

    // Vérifier que la zone appartient à l'utilisateur
    const { data: zone } = await supabaseAdmin
      .from('wifi_zones')
      .select('id')
      .eq('id', zoneId)
      .eq('owner_id', req.user.ownerId)
      .single();

    if (!zone) {
      return res.status(404).json({
        error: 'Wi-Fi zone not found'
      });
    }

    // Supprimer les tickets non vendus de la zone. Les tickets vendus restent:
    // sans eux, la comptabilite ne peut plus montrer le ticket remis au client.
    const { data: deletedTickets, error } = await supabaseAdmin
      .from('tickets')
      .delete()
      .eq('wifi_zone_id', zoneId)
      .neq('status', 'sold')
      .select('id');

    if (error) {
      logger.error('Error deleting tickets:', error);
      throw error;
    }

    logger.info(`Deleted ${deletedTickets?.length || 0} tickets for zone ${zoneId}`);

    res.json({
      message: 'Tickets deleted successfully',
      deleted: deletedTickets?.length || 0
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Rattache tous les tickets libres d'un profil MikroTik a un tarif.
 *
 * Sert au stock importe avant que le lien tarif/ticket n'existe, et a tout
 * import dont le profil n'etait pas encore declare. Le profil est aussi
 * memorise sur le tarif: les imports suivants se rattachent seuls.
 */
async function linkProfileToPricing(req, res, next) {
  try {
    const { zoneId } = req.params;
    const { profile, pricing_id } = req.body;

    const { data: zone } = await supabaseAdmin
      .from('wifi_zones')
      .select('id')
      .eq('id', zoneId)
      .eq('owner_id', req.user.ownerId)
      .single();

    if (!zone) {
      return res.status(404).json({ error: 'Wi-Fi zone not found' });
    }

    const { data: pricing } = await supabaseAdmin
      .from('pricings')
      .select('id, name')
      .eq('id', pricing_id)
      .eq('wifi_zone_id', zoneId)
      .single();

    if (!pricing) {
      return res.status(404).json({ error: 'Tarif introuvable pour cette zone' });
    }

    // Seuls les tickets libres sont deplaces: un ticket deja vendu garde le
    // tarif reellement paye par son client.
    let query = supabaseAdmin
      .from('tickets')
      .update({ pricing_id: pricing.id, updated_at: new Date().toISOString() })
      .eq('wifi_zone_id', zoneId)
      .eq('status', 'free')
      .is('pricing_id', null);

    query = profile ? query.eq('profile', profile) : query.is('profile', null);

    const { data: updated, error } = await query.select('id');

    if (error) {
      logger.error('Error linking profile to pricing:', error);
      return res.status(400).json({ error: 'Rattachement impossible', details: error.message });
    }

    // Memoriser le profil sur le tarif pour les imports suivants
    if (profile) {
      await supabaseAdmin
        .from('pricings')
        .update({ ticket_profile: profile })
        .eq('id', pricing.id);
    }

    logger.info(
      `Linked ${updated?.length || 0} tickets (profile ${profile || 'sans profil'}) to pricing ${pricing.id}`
    );

    res.json({
      message: `${updated?.length || 0} ticket(s) rattaché(s) au tarif ${pricing.name}`,
      linked: updated?.length || 0
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Tarifs dont le stock de tickets libres est bas, toutes zones du promoteur.
 * Alimente la cloche de notification: sans elle, une rupture ne se decouvre
 * qu'au moment ou un client ne peut plus acheter.
 */
async function getStockAlerts(req, res, next) {
  try {
    const { data: zones } = await supabaseAdmin
      .from('wifi_zones')
      .select('id, name')
      .eq('owner_id', req.user.ownerId);

    if (!zones || zones.length === 0) {
      return res.json({ threshold: LOW_STOCK_THRESHOLD, alerts: [] });
    }

    const zoneIds = zones.map((z) => z.id);
    const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]));

    const [{ data: pricings }, { data: freeTickets }] = await Promise.all([
      supabaseAdmin
        .from('pricings')
        .select('id, name, amount, wifi_zone_id')
        .in('wifi_zone_id', zoneIds)
        .eq('is_active', true),
      supabaseAdmin
        .from('tickets')
        .select('pricing_id')
        .in('wifi_zone_id', zoneIds)
        .eq('status', 'free')
    ]);

    const stock = {};
    (freeTickets || []).forEach((t) => {
      if (t.pricing_id) stock[t.pricing_id] = (stock[t.pricing_id] || 0) + 1;
    });

    const alerts = (pricings || [])
      .map((p) => ({
        pricing_id: p.id,
        pricing_name: p.name,
        amount: parseFloat(p.amount),
        zone_id: p.wifi_zone_id,
        zone_name: zoneName[p.wifi_zone_id] || '',
        available: stock[p.id] || 0
      }))
      .filter((a) => a.available <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.available - b.available);

    res.json({ threshold: LOW_STOCK_THRESHOLD, alerts });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTicketsByZone,
  importTickets,
  getTicketStats,
  getStockAlerts,
  linkProfileToPricing,
  deleteTicket,
  deleteAllTickets
};

