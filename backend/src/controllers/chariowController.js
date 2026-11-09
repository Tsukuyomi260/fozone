/**
 * Webhook Chariow : une vente payee cree l'acces et l'envoie toute seule.
 *
 * Chariow appelle ces webhooks des « Pulses ». La route est publique, comme
 * celle de Moneroo, et protegee de la meme facon : une signature HMAC-SHA256
 * calculee sur les octets bruts du corps, avant tout parsing.
 *
 * Deux regles gouvernent ce fichier, et viennent de la facon dont Chariow
 * fonctionne :
 *
 *   1. Chariow reessaie cinq fois quand on ne repond pas, puis desactive le
 *      Pulse. On repond donc 200 des que la vente est traitee ou reconnue
 *      comme deja traitee, et on ne renvoie une erreur que lorsqu'un reessai
 *      a une chance d'aboutir.
 *
 *   2. Le meme evenement peut donc arriver plusieurs fois. L'unicite de
 *      chariow_delivery_id et de chariow_sale_id en base refuse le doublon ;
 *      ici on rattrape ce refus au lieu de le traiter comme une panne.
 */

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');
const { creerAcces } = require('../services/licenceGuide');
const { envoyerLien } = require('../services/envoiGuide');
const { verifierTelephone } = require('../config/paysTelephone');

const EVENEMENTS_VENTE = ['successful.sale', 'successful_sale'];

/**
 * Compare la signature recue a celle qu'on recalcule.
 * Comparaison a temps constant : une comparaison ordinaire laisse deviner la
 * signature octet par octet.
 */
function signatureValide(corpsBrut, entete, secret) {
  if (!corpsBrut || !entete || !secret) return false;

  const attendu = crypto.createHmac('sha256', secret).update(corpsBrut).digest('hex');
  const recu = String(entete).replace(/^sha256=/, '').trim();

  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(recu, 'utf8');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

/** Chariow envoie le pays et le numero separement. */
function telephoneDe(client) {
  const brut = client && client.phone;
  if (!brut) return { telephone: null, pays: null };

  const numero = typeof brut === 'string' ? brut : brut.number;
  const indicatif = typeof brut === 'string' ? null : brut.country_code;
  const pays = (client.country || '').toUpperCase().slice(0, 2) || null;

  if (!numero) return { telephone: null, pays };

  // On tente la mise en forme, mais on n'en fait jamais une condition : la
  // vente est encaissee, refuser l'acces pour un numero mal forme serait
  // punir l'acheteur d'une faute de frappe.
  if (pays) {
    const verifie = verifierTelephone(numero, pays);
    if (verifie.ok) return { telephone: verifie.affichage, pays };
  }

  const prefixe = indicatif ? String(indicatif).replace(/^\+?/, '+') + ' ' : '';
  return { telephone: (prefixe + String(numero)).trim().slice(0, 40), pays };
}

function nomsDe(client) {
  if (!client) return { prenom: '', nom: '' };

  const prenom = (client.first_name || '').trim();
  const nom = (client.last_name || '').trim();
  if (prenom || nom) return { prenom, nom };

  // Pas de prenom ni de nom separes : on coupe le nom complet au premier mot.
  const complet = (client.name || '').trim();
  if (!complet) return { prenom: '', nom: '' };

  const morceaux = complet.split(/\s+/);
  return { prenom: morceaux.shift(), nom: morceaux.join(' ') };
}

/** Le montant arrive selon les cas en entier ou en decimal, dans divers champs. */
function montantDe(vente) {
  if (!vente) return null;

  const brut = vente.amount != null ? vente.amount
    : vente.total != null ? vente.total
      : vente.price;

  if (brut == null) return null;

  const nombre = Number(brut);
  return Number.isFinite(nombre) && nombre >= 0 ? Math.round(nombre) : null;
}

/**
 * POST /api/ebook/chariow
 */
async function recevoirVente(req, res) {
  const secret = process.env.CHARIOW_PULSE_SECRET;

  if (!secret) {
    logger.error('chariow: CHARIOW_PULSE_SECRET absent, webhook refuse');
    return res.status(503).json({ error: 'Webhook non configuré' });
  }

  if (!signatureValide(req.rawBody, req.headers['x-chariow-signature'], secret)) {
    logger.warn('chariow: signature invalide', { ip: req.ip, livraison: req.headers['x-pulse-delivery-id'] });
    return res.status(401).json({ error: 'Signature invalide' });
  }

  const charge = req.body || {};
  const evenement = String(charge.event || req.headers['x-pulse-event'] || '');

  // Tout ce qui n'est pas une vente aboutie est acquitte sans rien faire :
  // repondre en erreur ferait reessayer Chariow pour rien, cinq fois.
  if (!EVENEMENTS_VENTE.includes(evenement)) {
    logger.info('chariow: evenement ignore', { evenement });
    return res.json({ recu: true, ignore: evenement });
  }

  const livraison = String(req.headers['x-pulse-delivery-id'] || '').slice(0, 120) || null;
  const vente = charge.sale || charge.data || {};
  const venteId = String(vente.id || vente.sale_id || '').slice(0, 120) || null;
  const client = charge.customer || vente.customer || {};

  // Deja traite ? On repond 200 : c'est un reessai, pas une panne.
  if (livraison || venteId) {
    const filtres = [];
    if (livraison) filtres.push('chariow_delivery_id.eq.' + livraison);
    if (venteId) filtres.push('chariow_sale_id.eq.' + venteId);

    const { data: deja } = await supabaseAdmin
      .from('ebook_licences')
      .select('reference')
      .or(filtres.join(','))
      .maybeSingle();

    if (deja) {
      logger.info('chariow: vente deja traitee', { reference: deja.reference, venteId });
      return res.json({ recu: true, deja_traite: true, reference: deja.reference });
    }
  }

  const { prenom, nom } = nomsDe(client);
  if (!prenom && !nom) {
    // Sans nom, impossible de marquer l'exemplaire. On acquitte quand meme :
    // reessayer donnerait le meme resultat. La vente est signalee pour
    // traitement a la main.
    logger.error('chariow: vente sans nom d\'acheteur', { venteId, client });
    return res.json({ recu: true, ignore: 'acheteur sans nom' });
  }

  const { telephone, pays } = telephoneDe(client);

  let licence;
  try {
    licence = await creerAcces(
      { prenom, nom, telephone, pays, email: (client.email || '').trim() || null },
      {
        montant: montantDe(vente),
        devise: (vente.currency || 'XOF').toUpperCase().slice(0, 3),
        provenance: 'chariow',
        note: charge.product && charge.product.name ? String(charge.product.name).slice(0, 500) : null,
        max_appareils: 2,
        chariow_sale_id: venteId,
        chariow_delivery_id: livraison
      }
    );
  } catch (erreur) {
    // Course entre deux reessais simultanes : la base a refuse le doublon.
    if (/duplicate key|unique constraint/i.test(erreur.message)) {
      logger.info('chariow: doublon rattrape par la base', { venteId });
      return res.json({ recu: true, deja_traite: true });
    }

    // Panne reelle : on laisse Chariow reessayer.
    logger.error('chariow: creation impossible', { venteId, error: erreur.message });
    return res.status(500).json({ error: 'Création impossible' });
  }

  const envoi = await envoyerLien(licence);

  logger.info('chariow: vente traitee', {
    reference: licence.reference,
    venteId,
    envoye: envoi.envoye,
    raison: envoi.raison
  });

  return res.status(201).json({
    recu: true,
    reference: licence.reference,
    envoye: envoi.envoye
  });
}

module.exports = { recevoirVente, signatureValide };
