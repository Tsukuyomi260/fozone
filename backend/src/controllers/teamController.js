/**
 * Equipe d'un promoteur: plusieurs comptes sur les memes donnees.
 *
 * Un membre se connecte avec son propre email et son propre mot de passe,
 * mais travaille sur les zones, tickets et comptabilite de celui qui l'a
 * invite. Le solde est commun.
 *
 * Seul le proprietaire gere son equipe: un membre ne peut ni inviter ni
 * retirer quelqu'un, sinon il pourrait s'octroyer des complices ou evincer
 * le proprietaire lui-meme.
 */

const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');

/**
 * Refuse l'action si le compte connecte est un membre, pas le proprietaire.
 */
function ensureOwner(req, res) {
  if (req.user.isMember) {
    res.status(403).json({
      error: "Seul le propriétaire du compte peut gérer l'équipe"
    });
    return false;
  }
  return true;
}

/**
 * Liste des membres de l'equipe
 */
async function getTeam(req, res, next) {
  try {
    const { data: members, error } = await supabaseAdmin
      .from('team_members')
      .select('id, created_at, users!team_members_member_id_fkey(id, email, full_name, is_active)')
      .eq('owner_id', req.user.ownerId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error loading team:', error);
      return res.status(500).json({
        error: 'Failed to load team',
        details: error.message
      });
    }

    res.json({
      members: (members || []).map((m) => ({
        membership_id: m.id,
        added_at: m.created_at,
        ...m.users
      })),
      // Le membre voit l'equipe mais ne peut pas la modifier
      can_manage: !req.user.isMember
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Ajoute un membre. Cree le compte s'il n'existe pas encore.
 */
async function addMember(req, res, next) {
  try {
    if (!ensureOwner(req, res)) return;

    const { email, password, full_name } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    let accountWasCreated = false;

    let { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, is_active')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (user) {
      if (user.id === req.user.ownerId) {
        return res.status(400).json({
          error: 'Vous ne pouvez pas vous ajouter vous-même'
        });
      }

      // Un compte n'appartient qu'a une equipe: la contrainte UNIQUE en base
      // le garantit, mais un message clair vaut mieux qu'une erreur SQL.
      const { data: existing } = await supabaseAdmin
        .from('team_members')
        .select('owner_id')
        .eq('member_id', user.id)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({
          error:
            existing.owner_id === req.user.ownerId
              ? 'Cette personne fait déjà partie de votre équipe'
              : "Ce compte appartient déjà à une autre équipe"
        });
      }

      // Un promoteur qui possede ses propres zones ne peut pas devenir
      // membre: ses zones deviendraient inaccessibles pour lui.
      const { count: ownedZones } = await supabaseAdmin
        .from('wifi_zones')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id);

      if (ownedZones > 0) {
        return res.status(400).json({
          error: 'Ce compte possède déjà ses propres zones Wi-Fi'
        });
      }
    } else {
      // Creation directe, sans passer par /register: le compte est valide
      // par le proprietaire qui l'invite, pas par la plateforme.
      if (!password || password.length < 6) {
        return res.status(400).json({
          error: 'Un mot de passe d\'au moins 6 caractères est requis pour créer le compte'
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const { data: created, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          email: normalizedEmail,
          password_hash: passwordHash,
          full_name: full_name?.trim() || null,
          role: 'admin',
          is_active: true
        })
        .select('id, email, full_name, is_active')
        .single();

      if (createError) {
        logger.error('Error creating member account:', createError);
        return res.status(400).json({
          error: 'Impossible de créer le compte',
          details: createError.message
        });
      }

      user = created;
      accountWasCreated = true;
    }

    const { error: linkError } = await supabaseAdmin
      .from('team_members')
      .insert({ owner_id: req.user.ownerId, member_id: user.id });

    if (linkError) {
      logger.error('Error linking member:', linkError);

      // Le compte vient d'etre cree pour cette invitation: s'il ne peut pas
      // etre rattache, il ne sert a rien et resterait orphelin, avec un
      // email desormais pris qui bloquerait une nouvelle tentative.
      if (accountWasCreated) {
        await supabaseAdmin.from('users').delete().eq('id', user.id);
      }

      return res.status(400).json({
        error: "Impossible d'ajouter ce membre",
        details: linkError.message
      });
    }

    logger.info(`Team member added: ${user.email} to owner ${req.user.ownerId}`);

    res.status(201).json({
      message: `${user.email} a maintenant accès à votre compte`,
      member: user
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retire un membre. Son compte reste, il perd seulement l'acces.
 */
async function removeMember(req, res, next) {
  try {
    if (!ensureOwner(req, res)) return;

    const { id } = req.params;

    // Filtre sur owner_id: on ne peut retirer que ses propres membres
    const { data: deleted, error } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('id', id)
      .eq('owner_id', req.user.ownerId)
      .select()
      .single();

    if (error || !deleted) {
      return res.status(404).json({ error: 'Membre introuvable' });
    }

    logger.info(`Team member removed: ${deleted.member_id} from owner ${req.user.ownerId}`);

    res.json({ message: "Accès retiré" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTeam,
  addMember,
  removeMember
};
