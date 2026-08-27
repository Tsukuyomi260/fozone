/**
 * Contrôleur pour la gestion des paiements
 * Gère la création de paiements et les webhooks Moneroo
 */

const { supabaseAdmin } = require('../config/database');
const { createPayment, verifyPayment, verifyWebhookSignature, parseWebhookPayload } = require('../services/moneroo');
const { assignTicketAtomically } = require('../utils/ticketManager');
const { checkIdempotency, saveIdempotency } = require('../utils/idempotency');
const { platformFeeOn, netToTenant } = require('../config/platformCommission');
const logger = require('../config/logger');

/**
 * Extrait le numero du payeur d'un objet paiement Moneroo.
 * Le client saisit son numero sur la page de paiement, pas dans notre app:
 * c'est donc Moneroo qui le detient. Le webhook ne porte pas toujours le
 * champ, et son emplacement varie selon la passerelle, d'ou les alternatives.
 */
function extractPayerPhone(data) {
  return (
    data?.customer?.phone ||
    data?.payment_phone_number ||
    data?.capture?.phone_number ||
    data?.capture?.gateway?.phone_number ||
    null
  );
}

/**
 * Crée une intention de paiement pour un client
 * Route publique (pas d'auth requise car appelée depuis le portail captif)
 */
async function createPaymentIntent(req, res, next) {
  try {
    const { wifi_zone_id, pricing_id, customer } = req.body;

    // Vérifier que la zone Wi-Fi existe
    const { data: zone, error: zoneError } = await supabaseAdmin
      .from('wifi_zones')
      .select('id, name, owner_id')
      .eq('id', wifi_zone_id)
      .single();

    if (zoneError || !zone) {
      return res.status(404).json({
        error: 'Wi-Fi zone not found'
      });
    }

    // Le montant est toujours lu en base a partir du tarif: il n'est jamais
    // accepte depuis la requete, sinon le client fixerait son propre prix.
    const { data: pricing } = await supabaseAdmin
      .from('pricings')
      .select('id, name, amount, duration_hours, description')
      .eq('id', pricing_id)
      .eq('wifi_zone_id', wifi_zone_id)
      .eq('is_active', true)
      .single();

    if (!pricing) {
      return res.status(400).json({
        error: 'Invalid pricing for this zone'
      });
    }

    const finalAmount = parseFloat(pricing.amount);

    // Construire l'URL de retour (où le client sera redirigé après paiement)
    // Moneroo ajoutera paymentId et paymentStatus dans les query params
    const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/payment/return`;

    // Créer le paiement dans Moneroo avec le format requis
    const paymentResult = await createPayment({
      amount: finalAmount,
      currency: 'XOF',
      description: `Achat ticket Wi-Fi - ${zone.name}`,
      return_url: returnUrl,
      customer: {
        email: customer?.email || 'client@example.com',
        first_name: customer?.first_name || 'Client',
        last_name: customer?.last_name || 'WiFi',
        phone: customer?.phone || undefined // Ne pas envoyer si non fourni
      },
      metadata: {
        wifi_zone_id: wifi_zone_id,
        pricing_id: pricing_id || null
      },
      methods: ['mtn_bj', 'moov_bj'] // Méthodes disponibles au Bénin
    });

    if (!paymentResult.success) {
      return res.status(400).json({
        error: 'Failed to create payment',
        details: paymentResult.error,
        errors: paymentResult.errors
      });
    }

    // Enregistrer le paiement en base de données
    // Note: phone est NOT NULL dans le schéma, donc on fournit une valeur par défaut si non fourni
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        moneroo_payment_id: paymentResult.paymentId,
        wifi_zone_id: wifi_zone_id,
        amount: finalAmount,
        phone: customer?.phone || 'N/A', // Valeur par défaut (sera NULL après migration 006)
        pricing_id: pricing_id || null,
        // Copie du tarif au moment de la vente: la comptabilite ne doit pas
        // dependre d'une ligne pricings que le gerant peut supprimer ensuite.
        pricing_name: pricing.name,
        pricing_duration_hours: pricing.duration_hours,
        // Montants figes a la vente. Recalculer plus tard depuis un taux
        // devenu different fausserait retroactivement les soldes, y compris
        // ceux deja verses au promoteur.
        owner_id: zone.owner_id,
        platform_fee: platformFeeOn(finalAmount),
        net_to_tenant: netToTenant(finalAmount),
        status: 'pending',
        currency: 'XOF'
      })
      .select()
      .single();

    if (paymentError) {
      logger.error('Error saving payment:', paymentError);
      return res.status(500).json({
        error: 'Failed to save payment'
      });
    }

    logger.info(`Payment intent created: ${payment.id} for zone ${wifi_zone_id}`);

    res.status(201).json({
      message: 'Payment intent created',
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        checkout_url: paymentResult.checkoutUrl
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Webhook Moneroo pour les confirmations de paiement
 * Route publique mais sécurisée par signature
 */
async function handleMonerooWebhook(req, res, next) {
  try {
    const signature = req.headers['x-moneroo-signature'];
    
    // La signature porte sur les octets exactement tels que Moneroo les a envoyes.
    // Re-serialiser req.body avec JSON.stringify produirait une chaine differente
    // des que l'espacement, l'ordre des cles ou l'echappement unicode diffère.
    const rawBody = req.rawBody
      ? req.rawBody.toString('utf8')
      : JSON.stringify(req.body);
    
    // Vérifier la signature du webhook (HMAC-SHA256 du payload stringifié)
    if (!verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid webhook signature received');
      return res.status(403).json({
        error: 'Invalid signature'
      });
    }

    // Parser le payload selon le format Moneroo : { event, data }
    const webhookPayload = parseWebhookPayload(req.body);
    const { event, paymentId, status } = webhookPayload;

    // Vérifier l'idempotence (utiliser l'event + paymentId pour éviter les doublons)
    const idempotencyKey = `moneroo_${event}_${paymentId}`;
    const idempotencyCheck = await checkIdempotency(idempotencyKey);

    if (!idempotencyCheck.isNew) {
      logger.info(`Webhook already processed: ${idempotencyKey}`);
      // Retourner le ticket déjà attribué
      const { data: existingPayment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('id', idempotencyCheck.paymentId)
        .single();
      
      // Récupérer les tickets associés
      if (existingPayment) {
        const { data: tickets } = await supabaseAdmin
          .from('tickets')
          .select('username, password')
          .eq('payment_id', existingPayment.id);
        
        if (tickets) {
          existingPayment.tickets = tickets;
        } else {
          existingPayment.tickets = [];
        }
      }

      return res.json({
        message: 'Webhook already processed',
        payment: existingPayment
      });
    }

    // Récupérer le paiement
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('moneroo_payment_id', paymentId)
      .single();

    if (paymentError || !payment) {
      logger.error('Payment not found for webhook:', paymentId);
      return res.status(404).json({
        error: 'Payment not found'
      });
    }

    // Un paiement deja marque 'completed' n'est reellement termine que si un
    // ticket a ete attribue. Un echec d'attribution lors d'un webhook precedent
    // laisse un paiement encaisse sans ticket: il faut alors reessayer, sinon le
    // rejeu de Moneroo refermerait le probleme sans jamais livrer le client.
    if (payment.status === 'completed') {
      const { data: existingTickets } = await supabaseAdmin
        .from('tickets')
        .select('id')
        .eq('payment_id', payment.id);

      if (existingTickets && existingTickets.length > 0) {
        await saveIdempotency(idempotencyKey, payment.id);
        return res.status(200).json({
          message: 'Payment already completed'
        });
      }

      logger.warn(
        'Payment ' + payment.id + ' is completed but has no ticket: retrying assignment'
      );
    }

    // Traiter selon le type d'événement Moneroo
    // payment.success, payment.failed, payment.cancelled, payment.initiated
    if (event === 'payment.success' && status === 'success') {
      // Le numero du payeur n'existe que chez Moneroo: on le recupere ici,
      // sinon la comptabilite n'affiche que le 'N/A' pose a la creation.
      let payerPhone = extractPayerPhone(webhookPayload.data);

      if (!payerPhone) {
        // Le webhook ne transporte pas le dossier complet: on interroge l'API.
        const verified = await verifyPayment(paymentId);
        if (verified.success) {
          payerPhone = extractPayerPhone(verified.payment);
        } else {
          logger.warn(`Could not verify payment ${paymentId} to read payer phone: ${verified.error}`);
        }
      }

      if (!payerPhone) {
        // Moneroo ne place pas toujours le numero au meme endroit selon la
        // passerelle. On journalise le dossier complet une fois pour toutes
        // afin de reperer le champ exact et cibler l'extraction ensuite.
        logger.warn(
          'Payer phone not found for ' + paymentId + ' - payload: ' +
          JSON.stringify(webhookPayload.data)
        );
      }

      // Mettre à jour le statut du paiement
      const { error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          transaction_id: webhookPayload.data?.capture?.gateway?.transaction_id || null,
          ...(payerPhone ? { phone: payerPhone } : {})
        })
        .eq('id', payment.id);

      if (updateError) {
        logger.error('Error updating payment status:', updateError);
        throw updateError;
      }

      // Attribuer un ticket de manière atomique
      const ticketAssignment = await assignTicketAtomically(
        payment.wifi_zone_id,
        payment.id
      );

      if (!ticketAssignment.success) {
        // Le paiement est encaisse mais aucun ticket n'a pu etre attribue.
        // On ne marque PAS l'idempotence: le 500 pousse Moneroo a rejouer le
        // webhook, et le rejeu retentera l'attribution (voir plus haut).
        logger.error(
          'PAYMENT WITHOUT TICKET - action requise: paiement ' + payment.id +
          ' encaisse pour la zone ' + payment.wifi_zone_id +
          ' mais aucun ticket libre. Cause: ' + ticketAssignment.error
        );
        return res.status(500).json({
          error: 'Payment confirmed but ticket assignment failed',
          details: ticketAssignment.error
        });
      }

      // Enregistrer l'idempotence
      await saveIdempotency(idempotencyKey, payment.id);

      logger.info(`Payment ${payment.id} completed, ticket ${ticketAssignment.ticket.id} assigned`);

      res.status(200).json({
        message: 'Payment processed successfully',
        payment: {
          id: payment.id,
          status: 'completed'
        },
        ticket: {
          id: ticketAssignment.ticket.id,
          username: ticketAssignment.ticket.username,
          password: ticketAssignment.ticket.password
        }
      });
    } else if (event === 'payment.failed' || event === 'payment.cancelled') {
      // Mettre à jour le statut du paiement en échec
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      await saveIdempotency(idempotencyKey, payment.id);

      res.status(200).json({
        message: 'Payment failed',
        payment: {
          id: payment.id,
          status: 'failed'
        }
      });
    } else {
      // Autres événements (payment.initiated, etc.) - juste enregistrer l'idempotence
      await saveIdempotency(idempotencyKey, payment.id);
      res.status(200).json({
        message: 'Webhook received',
        event: event
      });
    }
  } catch (error) {
    logger.error('Error processing webhook:', error);
    next(error);
  }
}

/**
 * Retrouve le dernier ticket achete depuis un numero de telephone.
 * Route publique: le client ne connait ni l'UUID interne ni l'identifiant
 * Moneroo. La passerelle lui montre sa propre reference (FPID FedaPay), que
 * nous ne stockons pas. Son numero est la seule cle qu'il possede.
 */
async function getPaymentsByPhone(req, res, next) {
  try {
    const digits = String(req.params.phone).replace(/\D/g, '');
    const phone = digits.length === 8 ? `229${digits}` : digits;

    const { data: payments, error } = await supabaseAdmin
      .from('payments')
      .select('*, wifi_zones(name, router_ip), pricings(duration_hours, name)')
      .eq('phone', phone)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error('Error looking up payments by phone:', error);
      return res.status(500).json({ error: 'Failed to look up payment' });
    }

    if (!payments || payments.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = payments[0];

    // La relation va de tickets vers payments: le join imbrique n'est pas
    // disponible dans ce sens, on charge les tickets separement.
    const { data: tickets } = await supabaseAdmin
      .from('tickets')
      .select('username, password')
      .eq('payment_id', payment.id);

    payment.tickets = tickets || [];

    res.json({ payment });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les informations d'un paiement (pour le client)
 * Le paymentId peut être soit un UUID interne, soit un ID Moneroo (py_xxx)
 * Si le paiement est en attente, on vérifie aussi avec Moneroo pour mettre à jour le statut
 */
async function getPaymentStatus(req, res, next) {
  try {
    const { paymentId } = req.params;

    // Déterminer si c'est un UUID ou un ID Moneroo
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId);
    
    // Récupérer le paiement avec le pricing associé et router_ip
    let query = supabaseAdmin
      .from('payments')
      .select('*, wifi_zones(name, router_ip), pricings(duration_hours, name)');

    // Si c'est un UUID, chercher par id, sinon chercher par moneroo_payment_id
    if (isUUID) {
      query = query.eq('id', paymentId);
    } else {
      // C'est un ID Moneroo (py_xxx ou test_xxx)
      query = query.eq('moneroo_payment_id', paymentId);
    }

    const { data: payment, error } = await query.single();

    if (error || !payment) {
      logger.warn(`Payment not found: ${paymentId} (isUUID: ${isUUID})`);
      return res.status(404).json({
        error: 'Payment not found'
      });
    }

    // Récupérer les tickets associés à ce paiement
    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('tickets')
      .select('username, password')
      .eq('payment_id', payment.id);

    if (!ticketsError && tickets) {
      payment.tickets = tickets;
    } else {
      payment.tickets = [];
    }

    // Si le paiement est en attente et qu'on a un ID Moneroo, vérifier le statut avec Moneroo
    if (payment.status === 'pending' && payment.moneroo_payment_id) {
      logger.info(`Checking payment status with Moneroo: ${payment.moneroo_payment_id}`);
      const verifyResult = await verifyPayment(payment.moneroo_payment_id);
      
      if (verifyResult.success && verifyResult.payment) {
        const monerooStatus = verifyResult.payment.status;
        
        // Si le paiement est confirmé sur Moneroo mais pas encore dans notre DB, traiter le webhook
        if (monerooStatus === 'success' && payment.status !== 'completed') {
          logger.info(`Payment ${payment.moneroo_payment_id} confirmed on Moneroo, processing...`);
          
          // Mettre à jour le statut et attribuer le ticket
          const { error: updateError } = await supabaseAdmin
            .from('payments')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', payment.id);

          if (!updateError) {
            // Attribuer un ticket
            const ticketResult = await assignTicketAtomically(
              payment.wifi_zone_id,
              payment.id
            );

            if (ticketResult.success) {
              logger.info(`Ticket assigned to payment ${payment.id}`);
              // Recharger le paiement avec le ticket et le pricing
              const { data: updatedPayment } = await supabaseAdmin
                .from('payments')
                .select('*, wifi_zones(name, router_ip), pricings(duration_hours, name)')
                .eq('id', payment.id)
                .single();
              
              // Récupérer les tickets associés
              const { data: tickets } = await supabaseAdmin
                .from('tickets')
                .select('username, password')
                .eq('payment_id', updatedPayment.id);
              
              if (tickets) {
                updatedPayment.tickets = tickets;
              } else {
                updatedPayment.tickets = [];
              }
              
              return res.json({
                payment: updatedPayment
              });
            }

            // Sans cette trace, un paiement encaisse sans ticket ne laisse
            // aucune trace: le client repart les mains vides en silence.
            logger.error(
              'PAYMENT WITHOUT TICKET - action requise: paiement ' + payment.id +
              ' confirme via verify pour la zone ' + payment.wifi_zone_id +
              ' mais aucun ticket attribue. Cause: ' + ticketResult.error
            );
          } else {
            logger.error(
              'Error marking payment ' + payment.id + ' as completed: ' + updateError.message
            );
          }
        }
      }
    }

    res.json({
      payment: payment
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère tous les paiements d'une zone Wi-Fi (pour l'admin)
 */
async function getPaymentsByZone(req, res, next) {
  try {
    const { zoneId } = req.params;
    const { status, page = 1, limit = 50 } = req.query;

    // Vérifier que la zone appartient à l'utilisateur
    const { data: zone } = await supabaseAdmin
      .from('wifi_zones')
      .select('id')
      .eq('id', zoneId)
      .eq('owner_id', req.user.id)
      .single();

    if (!zone) {
      return res.status(404).json({
        error: 'Wi-Fi zone not found'
      });
    }

    let query = supabaseAdmin
      .from('payments')
      .select('*, tickets(id, username), pricings(amount, duration_hours)')
      .eq('wifi_zone_id', zoneId);

    if (status) {
      query = query.eq('status', status);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: payments, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('Error fetching payments:', error);
      throw error;
    }

    res.json({
      payments: payments || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPaymentsByPhone,
  createPaymentIntent,
  handleMonerooWebhook,
  getPaymentStatus,
  getPaymentsByZone
};

