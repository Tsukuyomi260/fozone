/**
 * Contrôleur pour la gestion des zones Wi-Fi
 * CRUD complet pour les zones Wi-Fi
 */

const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');

/**
 * Récupère toutes les zones Wi-Fi de l'utilisateur
 */
async function getAllZones(req, res, next) {
  try {
    const { data: zones, error } = await supabaseAdmin
      .from('wifi_zones')
      .select('*')
      .eq('owner_id', req.user.ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching wifi zones:', error);
      throw error;
    }

    res.json({
      zones: zones || []
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les informations publiques d'une zone Wi-Fi (route publique)
 */
async function getPublicZoneById(req, res, next) {
  try {
    const { id } = req.params;

    const { data: zone, error } = await supabaseAdmin
      .from('wifi_zones')
      .select('id, name')
      .eq('id', id)
      .single();

    if (error || !zone) {
      return res.status(404).json({
        error: 'Wi-Fi zone not found'
      });
    }

    res.json({
      zone: zone
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère une zone Wi-Fi par son ID
 */
async function getZoneById(req, res, next) {
  try {
    const { id } = req.params;

    const { data: zone, error } = await supabaseAdmin
      .from('wifi_zones')
      .select('*')
      .eq('id', id)
      .eq('owner_id', req.user.ownerId)
      .single();

    if (error || !zone) {
      return res.status(404).json({
        error: 'Wi-Fi zone not found'
      });
    }

    res.json({
      zone: zone
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Crée une nouvelle zone Wi-Fi
 */
async function createZone(req, res, next) {
  try {
    const { name, router_ip, manager_phone, latitude, longitude, address } = req.body;

    const { data: zone, error } = await supabaseAdmin
      .from('wifi_zones')
      .insert({
        name: name,
        router_ip: router_ip,
        manager_phone: manager_phone,
        latitude: latitude || null,
        longitude: longitude || null,
        address: address || null,
        owner_id: req.user.ownerId
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating wifi zone:', error);
      return res.status(400).json({
        error: 'Failed to create Wi-Fi zone',
        details: error.message
      });
    }

    logger.info(`Wi-Fi zone created: ${zone.id} by user ${req.user.id}`);

    res.status(201).json({
      message: 'Wi-Fi zone created successfully',
      zone: zone
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Met à jour une zone Wi-Fi
 */
async function updateZone(req, res, next) {
  try {
    const { id } = req.params;
    const { name, router_ip, manager_phone, latitude, longitude, address } = req.body;

    // Vérifier que la zone appartient à l'utilisateur
    const { data: existingZone } = await supabaseAdmin
      .from('wifi_zones')
      .select('id')
      .eq('id', id)
      .eq('owner_id', req.user.ownerId)
      .single();

    if (!existingZone) {
      return res.status(404).json({
        error: 'Wi-Fi zone not found'
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (router_ip !== undefined) updateData.router_ip = router_ip;
    if (manager_phone !== undefined) updateData.manager_phone = manager_phone;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (address !== undefined) updateData.address = address;

    const { data: zone, error } = await supabaseAdmin
      .from('wifi_zones')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating wifi zone:', error);
      return res.status(400).json({
        error: 'Failed to update Wi-Fi zone'
      });
    }

    logger.info(`Wi-Fi zone updated: ${id}`);

    res.json({
      message: 'Wi-Fi zone updated successfully',
      zone: zone
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Supprime une zone Wi-Fi
 */
async function deleteZone(req, res, next) {
  try {
    const { id } = req.params;

    // Vérifier que la zone appartient à l'utilisateur
    const { data: existingZone } = await supabaseAdmin
      .from('wifi_zones')
      .select('id')
      .eq('id', id)
      .eq('owner_id', req.user.ownerId)
      .single();

    if (!existingZone) {
      return res.status(404).json({
        error: 'Wi-Fi zone not found'
      });
    }

    const { error } = await supabaseAdmin
      .from('wifi_zones')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting wifi zone:', error);
      return res.status(400).json({
        error: 'Failed to delete Wi-Fi zone'
      });
    }

    logger.info(`Wi-Fi zone deleted: ${id}`);

    res.json({
      message: 'Wi-Fi zone deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllZones,
  getPublicZoneById,
  getZoneById,
  createZone,
  updateZone,
  deleteZone
};

