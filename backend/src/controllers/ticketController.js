/**
 * Contrôleur pour la gestion des tickets
 * Gère l'import CSV, la consultation et les statistiques
 */

const csv = require('csv-parser');
const { Readable } = require('stream');
const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');

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

    // Si pricing_id est fourni, vérifier qu'il existe et appartient à la zone
    if (pricing_id) {
      const { data: pricing, error: pricingError } = await supabaseAdmin
        .from('pricings')
        .select('id, wifi_zone_id')
        .eq('id', pricing_id)
        .eq('wifi_zone_id', zoneId)
        .single();

      if (pricingError || !pricing) {
        logger.warn(`Pricing ${pricing_id} not found or doesn't belong to zone ${zoneId}`);
        // On continue quand même sans pricing_id
      }
    }

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
            const ticketData = {
              wifi_zone_id: zoneId,
              username: username.trim(),
              password: password.trim(),
              profile: (row.Profile || row.profile || row.profile_name || '').trim() || null,
              status: 'free',
              created_at: new Date().toISOString()
            };

            // Ajouter pricing_id si fourni (optionnel, pour référence future)
            // Note: On ne stocke pas pricing_id dans tickets car ce n'est pas dans le schéma
            // Mais on peut l'utiliser pour d'autres traitements si nécessaire

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

            logger.info(`Imported ${insertedTickets.length} tickets for zone ${zoneId}`);

            res.status(201).json({
              message: 'Tickets imported successfully',
              imported: insertedTickets.length,
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
      .select('id, wifi_zone_id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({
        error: 'Ticket not found'
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

    // Supprimer tous les tickets de la zone
    const { data: deletedTickets, error } = await supabaseAdmin
      .from('tickets')
      .delete()
      .eq('wifi_zone_id', zoneId)
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

module.exports = {
  getTicketsByZone,
  importTickets,
  getTicketStats,
  deleteTicket,
  deleteAllTickets
};

