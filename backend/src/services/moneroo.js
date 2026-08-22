/**
 * Service d'intégration avec Moneroo (agrégateur Mobile Money)
 * Gère la création de paiements et la validation des webhooks
 * Documentation: https://docs.moneroo.io
 */

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../config/logger');

// URL de base de l'API Moneroo : https://api.moneroo.io/v1
// Si MONEROO_BASE_URL est fourni sans /v1, on l'ajoute automatiquement
const baseUrl = process.env.MONEROO_BASE_URL || 'https://api.moneroo.io';
const MONEROO_BASE_URL = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
const MONEROO_API_KEY = process.env.MONEROO_API_KEY;
const MONEROO_WEBHOOK_SECRET = process.env.MONEROO_WEBHOOK_SECRET;

// Logger la configuration au démarrage (sans exposer la clé complète)
if (MONEROO_API_KEY) {
  logger.info('Moneroo API Key configured', {
    keyLength: MONEROO_API_KEY.length,
    keyPrefix: MONEROO_API_KEY.substring(0, 8) + '...',
    baseUrl: MONEROO_BASE_URL
  });
} else {
  logger.warn('⚠️  MONEROO_API_KEY is not configured! Payments will fail.');
}

if (!MONEROO_WEBHOOK_SECRET) {
  logger.warn('⚠️  MONEROO_WEBHOOK_SECRET is not configured! All webhooks will be rejected.');
}

/**
 * Crée une intention de paiement via Moneroo Standard Integration
 * @param {object} paymentData - Données du paiement
 * @param {number} paymentData.amount - Montant (integer)
 * @param {string} paymentData.currency - Devise (XOF par défaut pour Bénin)
 * @param {string} paymentData.description - Description du paiement
 * @param {string} paymentData.return_url - URL de retour après paiement
 * @param {object} paymentData.customer - Informations client
 * @param {string} paymentData.customer.email - Email du client
 * @param {string} paymentData.customer.first_name - Prénom
 * @param {string} paymentData.customer.last_name - Nom
 * @param {string} paymentData.customer.phone - Téléphone (optionnel)
 * @param {object} paymentData.metadata - Métadonnées additionnelles (optionnel)
 * @param {array} paymentData.methods - Méthodes de paiement disponibles (optionnel, ex: ["mtn_bj", "moov_bj"])
 * @returns {Promise<object>}
 */
async function createPayment(paymentData) {
  try {
    // Vérifier que l'API Key est configurée
    if (!MONEROO_API_KEY) {
      logger.error('MONEROO_API_KEY is not configured');
      return {
        success: false,
        error: 'Moneroo API key is not configured. Please set MONEROO_API_KEY in your .env file.'
      };
    }

    const {
      amount,
      currency = 'XOF',
      description,
      return_url,
      customer,
      metadata = {},
      methods = ['mtn_bj', 'moov_bj'] // Par défaut pour le Bénin
    } = paymentData;

    // Préparer le payload selon la documentation Moneroo
    const payload = {
      amount: parseInt(amount), // Doit être un integer
      currency: currency,
      description: description,
      return_url: return_url,
      customer: {
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name
      },
      metadata: metadata
    };

    // Ajouter le téléphone dans customer (pré-remplit le champ sur Moneroo)
    if (customer.phone) {
      payload.customer.phone = customer.phone;
      
      // Optionnel : Utiliser restricted_phone pour forcer l'utilisation de ce numéro
      // Format: { number: "22951345780", country_code: "BJ" }
      // Note: Si on utilise restricted_phone, on ne peut pas utiliser restrict_country_code
      // Pour l'instant, on laisse juste le phone dans customer pour pré-remplir
    }

    // Ajouter les méthodes de paiement si spécifiées
    if (methods && methods.length > 0) {
      payload.methods = methods;
    }

    const response = await axios.post(
      `${MONEROO_BASE_URL}/payments/initialize`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${MONEROO_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    // Vérifier le format de réponse Moneroo : { message, data, errors }
    if (response.status === 201 && response.data && response.data.data) {
      logger.info(`Payment initialized via Moneroo: ${response.data.data.id}`);

      return {
        success: true,
        paymentId: response.data.data.id,
        checkoutUrl: response.data.data.checkout_url,
        message: response.data.message,
        data: response.data.data
      };
    } else {
      logger.error('Unexpected response format from Moneroo:', response.data);
      return {
        success: false,
        error: 'Unexpected response format from Moneroo'
      };
    }
  } catch (error) {
    logger.error('Error creating Moneroo payment:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      apiKeyConfigured: !!MONEROO_API_KEY,
      apiKeyLength: MONEROO_API_KEY ? MONEROO_API_KEY.length : 0
    });
    
    // Gérer les erreurs selon le format Moneroo
    let errorMessage = error.response?.data?.message || 
                      error.response?.data?.errors?.[0]?.message || 
                      error.message;

    // Message plus explicite pour les erreurs 401 (Invalid API Key)
    if (error.response?.status === 401) {
      if (!MONEROO_API_KEY) {
        errorMessage = 'Moneroo API key is not configured. Please set MONEROO_API_KEY in your .env file.';
      } else {
        errorMessage = 'Invalid Moneroo API key. Please verify that MONEROO_API_KEY in your .env file is correct and matches your Moneroo dashboard.';
      }
    }

    return {
      success: false,
      error: errorMessage,
      errors: error.response?.data?.errors || null
    };
  }
}

/**
 * Vérifie le statut d'un paiement via l'endpoint verify
 * @param {string} paymentId - ID du paiement Moneroo
 * @returns {Promise<object>}
 */
async function verifyPayment(paymentId) {
  try {
    // Vérifier que l'API Key est configurée
    if (!MONEROO_API_KEY) {
      logger.error('MONEROO_API_KEY is not configured');
      return {
        success: false,
        error: 'Moneroo API key is not configured'
      };
    }

    const response = await axios.get(
      `${MONEROO_BASE_URL}/payments/${paymentId}/verify`,
      {
        headers: {
          'Authorization': `Bearer ${MONEROO_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    // Format de réponse : { message, data, errors }
    if (response.status === 200 && response.data && response.data.data) {
      return {
        success: true,
        payment: response.data.data,
        message: response.data.message
      };
    } else {
      return {
        success: false,
        error: 'Unexpected response format'
      };
    }
  } catch (error) {
    logger.error('Error verifying Moneroo payment:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    let errorMessage = error.response?.data?.message || 
                      error.response?.data?.errors?.[0]?.message || 
                      error.message;

    // Message plus explicite pour les erreurs 401 (Invalid API Key)
    if (error.response?.status === 401) {
      if (!MONEROO_API_KEY) {
        errorMessage = 'Moneroo API key is not configured';
      } else {
        errorMessage = 'Invalid Moneroo API key. Please verify your MONEROO_API_KEY.';
      }
    }

    return {
      success: false,
      error: errorMessage,
      errors: error.response?.data?.errors || null
    };
  }
}

/**
 * Vérifie la signature d'un webhook Moneroo
 * La signature est calculée avec HMAC-SHA256 du payload JSON stringifié
 * @param {string} payload - Corps du webhook (string JSON)
 * @param {string} signature - Signature reçue dans le header X-Moneroo-Signature
 * @returns {boolean}
 */
function verifyWebhookSignature(payload, signature) {
  try {
    if (!MONEROO_WEBHOOK_SECRET) {
      logger.error(
        "MONEROO_WEBHOOK_SECRET is not configured: every Moneroo webhook will be rejected " +
        "and no ticket will ever be delivered."
      );
      return false;
    }

    if (!signature || typeof signature !== "string") {
      logger.warn("Webhook received without X-Moneroo-Signature header");
      return false;
    }

    // La signature est calculée avec HMAC-SHA256 du payload (string)
    // Le payload doit être la chaîne JSON brute, pas un objet
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    const expectedSignature = crypto
      .createHmac('sha256', MONEROO_WEBHOOK_SECRET)
      .update(payloadString)
      .digest('hex');

    // Comparaison sécurisée pour éviter les attaques par timing.
    // timingSafeEqual exige deux buffers de meme longueur.
    const received = Buffer.from(signature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");

    if (received.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(received, expected);
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Parse le payload du webhook Moneroo
 * Format: { event: "payment.success", data: { id, status, amount, ... } }
 * @param {object} webhookPayload - Payload du webhook
 * @returns {object}
 */
function parseWebhookPayload(webhookPayload) {
  return {
    event: webhookPayload.event, // payment.success, payment.failed, etc.
    paymentId: webhookPayload.data?.id,
    status: webhookPayload.data?.status,
    amount: webhookPayload.data?.amount,
    currency: webhookPayload.data?.currency,
    data: webhookPayload.data
  };
}

module.exports = {
  createPayment,
  verifyPayment,
  verifyWebhookSignature,
  parseWebhookPayload
};
