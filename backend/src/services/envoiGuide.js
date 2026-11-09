/**
 * Envoi du lien d'acces a l'acheteur, par email.
 *
 * Passe par Resend, qui ne demande qu'une cle API et un domaine d'expedition
 * verifie. Aucune dependance ajoutee : leur API est un simple POST JSON.
 *
 * Variables attendues :
 *   RESEND_API_KEY        cle d'envoi
 *   EBOOK_EMAIL_EXPEDITEUR  ex. "NET ZONE <guide@fozone.org>" ; le domaine
 *                           doit etre verifie chez Resend, sinon l'envoi est
 *                           refuse ou finit en indesirables
 *
 * Sans cle configuree, l'envoi est ignore sans faire echouer la vente : la
 * licence existe, le dashboard la montre comme non envoyee, et le lien part
 * a la main. Un acheteur qui a paye ne doit jamais rester sans rien parce
 * qu'un service tiers est mal configure.
 */

const logger = require('../config/logger');
const { supabaseAdmin } = require('../config/database');

const RESEND_URL = 'https://api.resend.com/emails';

function echapper(valeur) {
  return String(valeur == null ? '' : valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function lienWhatsapp() {
  const chiffres = String(process.env.EBOOK_SUPPORT_WHATSAPP || '').replace(/\D/g, '');
  return chiffres ? 'https://wa.me/' + chiffres : null;
}

function corpsHtml(licence) {
  const prenom = echapper(licence.prenom || licence.nom || '');
  const lien = echapper(licence.lien);
  const editeur = echapper(process.env.EBOOK_EDITEUR_NOM || process.env.EBOOK_SUPPORT_NOM || 'NET ZONE');
  const appareils = licence.max_appareils || 2;
  const whatsapp = lienWhatsapp();

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#F5F7F6;font:16px/1.6 -apple-system,'Segoe UI',system-ui,sans-serif;color:#15211D">
  <div style="max-width:34rem;margin:0 auto;background:#fff;border:1px solid #D3DCD8;border-radius:12px;padding:28px">
    <p style="margin:0 0 16px;font-size:18px"><b>Bonjour ${prenom},</b></p>

    <p style="margin:0 0 20px">Merci pour ton achat. Voici ton acc&egrave;s personnel au guide
      <b>&laquo;&nbsp;Lancer sa Wi-Fi Zone&nbsp;&raquo;</b>.</p>

    <p style="margin:0 0 24px">
      <a href="${lien}" style="display:inline-block;background:#126B57;color:#fff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:600">Ouvrir mon guide</a>
    </p>

    <p style="margin:0 0 20px;font-size:14px;color:#55655F">Si le bouton ne fonctionne pas, copie cette adresse&nbsp;:<br>
      <span style="word-break:break-all;color:#126B57">${lien}</span></p>

    <div style="background:#DCEFE8;border-radius:9px;padding:14px 16px;margin:0 0 20px;font-size:14.5px">
      <p style="margin:0 0 8px"><b>&Agrave; ta premi&egrave;re ouverture</b>, tu choisiras un mot de passe.
        Note-le&nbsp;: il te servira &agrave; ouvrir le guide sur tes autres appareils.</p>
      <p style="margin:0">Ton acc&egrave;s fonctionne sur <b>${appareils} appareils</b> au maximum,
        ton t&eacute;l&eacute;phone et ton ordinateur par exemple.</p>
    </div>

    <p style="margin:0 0 20px;font-size:14px;color:#55655F">Cet exemplaire porte ton nom sur chacune de ses pages.
      Il t'est personnel&nbsp;: ne le partage pas.</p>

    ${whatsapp ? `<p style="margin:0;font-size:14px;color:#55655F">Une question&nbsp;?
      <a href="${echapper(whatsapp)}" style="color:#126B57">&Eacute;cris &agrave; ${editeur} sur WhatsApp</a>.</p>` : ''}
  </div>
</body></html>`;
}

function corpsTexte(licence) {
  const prenom = licence.prenom || licence.nom || '';
  const appareils = licence.max_appareils || 2;

  return `Bonjour ${prenom},

Merci pour ton achat. Voici ton acces personnel au guide « Lancer sa Wi-Fi Zone » :

${licence.lien}

A ta premiere ouverture, tu choisiras un mot de passe. Note-le : il te servira
a ouvrir le guide sur tes autres appareils.

Ton acces fonctionne sur ${appareils} appareils au maximum, ton telephone et ton
ordinateur par exemple.

Cet exemplaire porte ton nom sur chacune de ses pages. Il t'est personnel :
ne le partage pas.`;
}

/** Note dans la licence ce qui est parti, ou pourquoi rien n'est parti. */
async function noterEnvoi(licenceId, canal, erreur) {
  if (!licenceId) return;

  const { error } = await supabaseAdmin
    .from('ebook_licences')
    .update({
      lien_envoye_le: erreur ? null : new Date().toISOString(),
      lien_envoye_par: erreur ? null : canal,
      erreur_envoi: erreur ? String(erreur).slice(0, 500) : null
    })
    .eq('id', licenceId);

  if (error) logger.warn('guide: suivi d\'envoi non enregistre', { licence: licenceId, error: error.message });
}

/**
 * Envoie le lien par email.
 *
 * Ne leve jamais : une vente encaissee ne doit pas echouer parce qu'un email
 * n'est pas parti. Le resultat dit ce qui s'est passe, et la licence le garde.
 *
 * @returns {Promise<{envoye: boolean, raison?: string}>}
 */
async function envoyerLien(licence) {
  const cle = process.env.RESEND_API_KEY;
  const expediteur = process.env.EBOOK_EMAIL_EXPEDITEUR;

  if (!licence.email) {
    await noterEnvoi(licence.id, null, 'aucune adresse email');
    return { envoye: false, raison: 'aucune adresse email' };
  }

  if (!cle || !expediteur) {
    const raison = 'envoi non configure (RESEND_API_KEY ou EBOOK_EMAIL_EXPEDITEUR manquant)';
    logger.warn('guide: ' + raison, { reference: licence.reference });
    await noterEnvoi(licence.id, null, raison);
    return { envoye: false, raison };
  }

  try {
    const reponse = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + cle,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: expediteur,
        to: [licence.email],
        subject: 'Ton acces au guide « Lancer sa Wi-Fi Zone »',
        html: corpsHtml(licence),
        text: corpsTexte(licence)
      })
    });

    if (!reponse.ok) {
      const detail = await reponse.text();
      const raison = 'Resend a refusé (' + reponse.status + ') : ' + detail.slice(0, 200);
      logger.error('guide: email refuse', { reference: licence.reference, statut: reponse.status, detail: detail.slice(0, 300) });
      await noterEnvoi(licence.id, null, raison);
      return { envoye: false, raison };
    }

    logger.info('guide: lien envoye par email', { reference: licence.reference });
    await noterEnvoi(licence.id, 'email', null);
    return { envoye: true };
  } catch (erreur) {
    logger.error('guide: envoi impossible', { reference: licence.reference, error: erreur.message });
    await noterEnvoi(licence.id, null, erreur.message);
    return { envoye: false, raison: erreur.message };
  }
}

module.exports = { envoyerLien };
