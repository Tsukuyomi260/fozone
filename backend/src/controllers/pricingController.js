/**
 * Contrôleur pour la gestion des tarifs
 * Gère les tarifs par zone Wi-Fi
 */

const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');

/**
 * Récupère tous les tarifs actifs d'une zone Wi-Fi (route publique)
 */
async function getPublicPricingsByZone(req, res, next) {
  try {
    const { zoneId } = req.params;

    // Vérifier que la zone existe
    const { data: zone } = await supabaseAdmin
      .from('wifi_zones')
      .select('id')
      .eq('id', zoneId)
      .single();

    if (!zone) {
      return res.status(404).json({
        error: 'Wi-Fi zone not found'
      });
    }

    const { data: pricings, error } = await supabaseAdmin
      .from('pricings')
      .select('id, name, amount, duration_hours, description, is_active')
      .eq('wifi_zone_id', zoneId)
      .eq('is_active', true)
      .order('amount', { ascending: true });

    if (error) {
      logger.error('Error fetching public pricings:', error);
      throw error;
    }

    res.json({
      pricings: pricings || []
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère tous les tarifs d'une zone Wi-Fi
 */
async function getPricingsByZone(req, res, next) {
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

    const { data: pricings, error } = await supabaseAdmin
      .from('pricings')
      .select('id, name, amount, duration_hours, description, is_active, created_at, updated_at')
      .eq('wifi_zone_id', zoneId)
      .eq('is_active', true)
      .order('amount', { ascending: true });

    if (error) {
      logger.error('Error fetching pricings:', error);
      throw error;
    }

    // Log pour déboguer et vérifier les noms
    if (pricings && pricings.length > 0) {
      logger.info(`Fetched ${pricings.length} pricings for zone ${zoneId}`);
      pricings.forEach(p => {
        if (!p.name) {
          logger.warn(`⚠️ Pricing ${p.id} has no name!`);
        }
        logger.info(`  - Pricing ${p.id}: name="${p.name || 'NULL'}", amount=${p.amount}`);
      });
    }

    res.json({
      pricings: pricings || []
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Crée un nouveau tarif pour une zone Wi-Fi
 */
async function createPricing(req, res, next) {
  try {
    const { zoneId } = req.params;
    
    // Utiliser matchedData() pour obtenir les données validées et nettoyées par express-validator
    const { matchedData } = require('express-validator');
    const validatedData = matchedData(req, { locations: ['body'], includeOptionals: true });
    
    // Extraire les valeurs validées (matchedData contient les valeurs après trim() et validation)
    let name = validatedData.name;
    const amount = validatedData.amount !== undefined ? validatedData.amount : req.body.amount;
    const duration_hours = validatedData.duration_hours !== undefined ? validatedData.duration_hours : req.body.duration_hours;
    const description = validatedData.description || req.body.description;

    // Si name n'est pas dans validatedData, utiliser req.body (fallback)
    if (!name && req.body.name) {
      name = req.body.name.trim();
    }

    // Debug: Vérifier ce qui est reçu
    logger.info('Received body (raw):', JSON.stringify(req.body, null, 2));
    logger.info('Validated data (matchedData):', JSON.stringify(validatedData, null, 2));
    logger.info('Extracted name value:', name);
    logger.info('Extracted values:', JSON.stringify({ name, amount, duration_hours, description }, null, 2));

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

    // Valider que name est fourni et non vide
    // Note: express-validator a déjà trim() le champ, mais vérifions quand même
    const nameValue = (name || '').trim();
    if (!nameValue || nameValue === '') {
      logger.error('Name is missing or empty!', { name, nameValue, body: req.body });
      return res.status(400).json({
        error: 'Le nom du forfait est requis'
      });
    }

    logger.info(`Creating pricing with name: "${nameValue}" for zone ${zoneId}`);

    const insertData = {
      wifi_zone_id: zoneId,
      name: nameValue,
      amount: parseFloat(amount),
      duration_hours: duration_hours ? parseInt(duration_hours) : null,
      description: description ? description.trim() : null,
      is_active: true
    };

    logger.info('Insert data:', JSON.stringify(insertData, null, 2));

    const { data: pricing, error } = await supabaseAdmin
      .from('pricings')
      .insert(insertData)
      .select('id, name, amount, duration_hours, description, is_active, created_at, updated_at')
      .single();

    if (error) {
      logger.error('Error creating pricing:', error);
      logger.error('Error details:', JSON.stringify(error, null, 2));
      logger.error('Error code:', error.code);
      logger.error('Error hint:', error.hint);
      logger.error('Error details (PostgreSQL):', error.details);
      
      // Vérifier si c'est une erreur de contrainte NOT NULL
      if (error.code === '23502' || error.message?.includes('null value in column')) {
        return res.status(400).json({
          error: 'Le champ "name" est requis mais n\'a pas été sauvegardé',
          details: `Erreur base de données: ${error.message}. Vérifiez que la colonne "name" existe et est NOT NULL.`,
          hint: 'Exécutez la migration 003_make_name_not_null.sql dans Supabase'
        });
      }
      
      return res.status(400).json({
        error: 'Failed to create pricing',
        details: error.message || 'Erreur inconnue lors de la création',
        code: error.code,
        hint: error.hint
      });
    }

    // Vérifier que le nom a bien été sauvegardé
    if (!pricing.name) {
      logger.error(`⚠️ WARNING: Pricing created without name! ID: ${pricing.id}, Insert data:`, JSON.stringify(insertData, null, 2));
      
      // Essayer de corriger en mettant à jour directement
      const fallbackName = insertData.duration_hours 
        ? `${insertData.duration_hours} HEURES`
        : `FORFAIT ${insertData.amount} FCFA`;
      
      const { data: updatedPricing, error: updateError } = await supabaseAdmin
        .from('pricings')
        .update({ name: fallbackName })
        .eq('id', pricing.id)
        .select('id, name, amount, duration_hours, description, is_active, created_at, updated_at')
        .single();
      
      if (!updateError && updatedPricing) {
        logger.info(`✅ Nom corrigé automatiquement: "${fallbackName}"`);
        return res.status(201).json({
          message: 'Pricing created successfully',
          pricing: updatedPricing
        });
      }
    }

    logger.info(`Pricing created: ${pricing.id} for zone ${zoneId}, name: "${pricing.name || 'NULL/MISSING'}"`);

    res.status(201).json({
      message: 'Pricing created successfully',
      pricing: pricing
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Met à jour un tarif
 */
async function updatePricing(req, res, next) {
  try {
    const { id } = req.params;
    const { name, amount, duration_hours, description, is_active } = req.body;

    // Vérifier que le tarif appartient à une zone de l'utilisateur
    const { data: pricing } = await supabaseAdmin
      .from('pricings')
      .select('*, wifi_zones!inner(owner_id)')
      .eq('id', id)
      .single();

    if (!pricing || pricing.wifi_zones.owner_id !== req.user.ownerId) {
      return res.status(404).json({
        error: 'Pricing not found'
      });
    }

    const updateData = {};
    if (name !== undefined) {
      if (!name || name.trim() === '') {
        return res.status(400).json({
          error: 'Le nom du forfait est requis'
        });
      }
      updateData.name = name.trim();
    }
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (duration_hours !== undefined) {
      updateData.duration_hours = duration_hours ? parseInt(duration_hours) : null;
    }
    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }
    if (is_active !== undefined) updateData.is_active = is_active;

    logger.info('Update data:', JSON.stringify(updateData, null, 2));

    const { data: updatedPricing, error } = await supabaseAdmin
      .from('pricings')
      .update(updateData)
      .eq('id', id)
      .select('id, name, amount, duration_hours, description, is_active, created_at, updated_at')
      .single();

    if (error) {
      logger.error('Error updating pricing:', error);
      return res.status(400).json({
        error: 'Failed to update pricing'
      });
    }

    logger.info(`Pricing updated: ${id}`);

    res.json({
      message: 'Pricing updated successfully',
      pricing: updatedPricing
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime un tarif
 */
async function deletePricing(req, res, next) {
  try {
    const { id } = req.params;

    // Vérifier que le tarif appartient à une zone de l'utilisateur
    const { data: pricing } = await supabaseAdmin
      .from('pricings')
      .select('*, wifi_zones!inner(owner_id)')
      .eq('id', id)
      .single();

    if (!pricing || pricing.wifi_zones.owner_id !== req.user.ownerId) {
      return res.status(404).json({
        error: 'Pricing not found'
      });
    }

    // Les paiements conservent une copie du tarif (pricing_name,
    // pricing_duration_hours) et la cle etrangere est ON DELETE SET NULL:
    // supprimer un tarif detache les paiements sans alterer la comptabilite.
    const { error } = await supabaseAdmin
      .from('pricings')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting pricing:', error);
      return res.status(400).json({
        error: 'Failed to delete pricing',
        details: error.message
      });
    }

    logger.info(`Pricing deleted: ${id}`);

    res.json({
      message: 'Pricing deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPublicPricingsByZone,
  getPricingsByZone,
  createPricing,
  updatePricing,
  deletePricing
};

