/**
 * Contrôleur pour le dashboard admin
 * Fournit les statistiques et métriques
 */

const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');
const { netAmount } = require('../config/commission');

/**
 * Récupère les statistiques globales pour toutes les zones de l'utilisateur
 */
async function getGlobalStats(req, res, next) {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Récupérer toutes les zones de l'utilisateur
    const { data: zones } = await supabaseAdmin
      .from('wifi_zones')
      .select('id')
      .eq('owner_id', userId);

    const zoneIds = zones?.map(z => z.id) || [];

    if (zoneIds.length === 0) {
      return res.json({
        stats: {
          total_revenue: 0,
          total_tickets_sold: 0,
          today_revenue: 0,
          today_revenue_net: 0,
          today_tickets_sold: 0,
          total_zones: 0,
          active_zones: 0
        }
      });
    }

    // Chiffre d'affaires total
    const { data: totalRevenueData } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .in('wifi_zone_id', zoneIds)
      .eq('status', 'completed');

    const total_revenue = totalRevenueData?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Recettes du jour
    const { data: todayRevenueData } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .in('wifi_zone_id', zoneIds)
      .eq('status', 'completed')
      .gte('completed_at', todayISO);

    const today_revenue = todayRevenueData?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Nombre total de tickets vendus
    const { count: totalTicketsSold } = await supabaseAdmin
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .in('wifi_zone_id', zoneIds)
      .eq('status', 'sold');

    // Tickets vendus aujourd'hui
    const { count: todayTicketsSold } = await supabaseAdmin
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .in('wifi_zone_id', zoneIds)
      .eq('status', 'sold')
      .gte('sold_at', todayISO);

    // Zones actives (avec au moins un ticket vendu)
    const { data: activeZonesData } = await supabaseAdmin
      .from('tickets')
      .select('wifi_zone_id')
      .in('wifi_zone_id', zoneIds)
      .eq('status', 'sold');

    const activeZoneIds = [...new Set(activeZonesData?.map(t => t.wifi_zone_id) || [])];

    res.json({
      stats: {
        total_revenue: total_revenue,
        total_tickets_sold: totalTicketsSold || 0,
        today_revenue: today_revenue,
        // Ce que le gerant touche reellement, commission agregateur deduite
        today_revenue_net: netAmount(today_revenue),
        today_tickets_sold: todayTicketsSold || 0,
        total_zones: zoneIds.length,
        active_zones: activeZoneIds.length
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les statistiques détaillées pour une zone Wi-Fi spécifique
 */
async function getZoneStats(req, res, next) {
  try {
    const { zoneId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Vérifier que la zone appartient à l'utilisateur
    const { data: zone } = await supabaseAdmin
      .from('wifi_zones')
      .select('id, name')
      .eq('id', zoneId)
      .eq('owner_id', req.user.id)
      .single();

    if (!zone) {
      return res.status(404).json({
        error: 'Wi-Fi zone not found'
      });
    }

    // Chiffre d'affaires total de la zone
    const { data: totalRevenueData } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('wifi_zone_id', zoneId)
      .eq('status', 'completed');

    const total_revenue = totalRevenueData?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Recettes du jour
    const { data: todayRevenueData } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('wifi_zone_id', zoneId)
      .eq('status', 'completed')
      .gte('completed_at', todayISO);

    const today_revenue = todayRevenueData?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

    // Statistiques de tickets
    const { data: tickets } = await supabaseAdmin
      .from('tickets')
      .select('status, sold_at')
      .eq('wifi_zone_id', zoneId);

    const total_tickets = tickets?.length || 0;
    const sold_tickets = tickets?.filter(t => t.status === 'sold').length || 0;
    const free_tickets = tickets?.filter(t => t.status === 'free').length || 0;
    const today_sold = tickets?.filter(t => t.status === 'sold' && t.sold_at && new Date(t.sold_at) >= today).length || 0;

    // Paiements récents (7 derniers jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    const { data: recentPayments } = await supabaseAdmin
      .from('payments')
      .select('amount, created_at, status')
      .eq('wifi_zone_id', zoneId)
      .gte('created_at', sevenDaysAgoISO)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      zone: {
        id: zone.id,
        name: zone.name
      },
      stats: {
        total_revenue: total_revenue,
        today_revenue: today_revenue,
        total_tickets: total_tickets,
        sold_tickets: sold_tickets,
        free_tickets: free_tickets,
        today_tickets_sold: today_sold
      },
      recent_payments: recentPayments || []
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les statistiques par période (pour graphiques)
 */
async function getStatsByPeriod(req, res, next) {
  try {
    const { zoneId } = req.params;
    const { period = '7d' } = req.query; // 7d, 30d, 90d, 1y

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

    // Calculer la date de début selon la période
    const startDate = new Date();
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Récupérer les paiements par jour
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('amount, completed_at')
      .eq('wifi_zone_id', zoneId)
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .order('completed_at', { ascending: true });

    // Grouper par jour
    const dailyStats = {};
    payments?.forEach(payment => {
      const date = new Date(payment.completed_at).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { revenue: 0, count: 0 };
      }
      dailyStats[date].revenue += parseFloat(payment.amount || 0);
      dailyStats[date].count += 1;
    });

    res.json({
      period: period,
      daily_stats: Object.entries(dailyStats).map(([date, stats]) => ({
        date: date,
        revenue: stats.revenue,
        tickets_sold: stats.count
      }))
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getGlobalStats,
  getZoneStats,
  getStatsByPeriod
};

