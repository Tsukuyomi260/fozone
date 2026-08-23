/**
 * Contrôleur pour la comptabilité
 * Gère les recettes, commissions et statistiques financières
 */

const { supabaseAdmin } = require('../config/database');
const logger = require('../config/logger');

// Le taux est partage avec le dashboard: une seule source de verite
const { COMMISSION_RATE, commissionOn, netAmount } = require('../config/commission');

/**
 * Récupère les statistiques de paiements par période (pour graphiques)
 */
async function getPaymentStats(req, res, next) {
  try {
    const userId = req.user.id;
    const { year, month, period = 'days' } = req.query; // period: 'days', 'weeks', 'months'

    // Récupérer toutes les zones de l'utilisateur
    const { data: zones } = await supabaseAdmin
      .from('wifi_zones')
      .select('id')
      .eq('owner_id', userId);

    const zoneIds = zones?.map(z => z.id) || [];

    if (zoneIds.length === 0) {
      return res.json({
        stats: []
      });
    }

    // Construire la date de début selon l'année et le mois
    const startDate = new Date();
    if (year) startDate.setFullYear(parseInt(year));
    if (month) {
      startDate.setMonth(parseInt(month) - 1);
      startDate.setDate(1);
    } else {
      startDate.setMonth(0);
      startDate.setDate(1);
    }
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    if (month) {
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0); // Dernier jour du mois
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
      endDate.setDate(0); // Dernier jour de l'année
    }
    endDate.setHours(23, 59, 59, 999);

    // Récupérer les paiements
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('amount, completed_at')
      .in('wifi_zone_id', zoneIds)
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString())
      .order('completed_at', { ascending: true });

    // Grouper par jour
    const dailyStats = {};
    payments?.forEach(payment => {
      const date = new Date(payment.completed_at);
      const dayKey = period === 'days' 
        ? `Jour ${date.getDate()}`
        : date.toISOString().split('T')[0];
      
      if (!dailyStats[dayKey]) {
        dailyStats[dayKey] = { revenue: 0, count: 0 };
      }
      // Ventes nettes: ce que le gerant touche, commission agregateur deduite.
      // Le net est calcule paiement par paiement, comme dans le tableau, pour que
      // le graphique et l'historique affichent exactement les memes chiffres.
      dailyStats[dayKey].revenue += netAmount(payment.amount);
      dailyStats[dayKey].count += 1;
    });

    res.json({
      stats: Object.entries(dailyStats).map(([day, stats]) => ({
        day: day,
        revenue: stats.revenue,
        tickets_sold: stats.count
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère les tickets vendus par période (pour graphiques)
 */
async function getTicketsSoldStats(req, res, next) {
  try {
    const userId = req.user.id;
    const { month, period = 'days' } = req.query;

    // Récupérer toutes les zones de l'utilisateur
    const { data: zones } = await supabaseAdmin
      .from('wifi_zones')
      .select('id')
      .eq('owner_id', userId);

    const zoneIds = zones?.map(z => z.id) || [];

    if (zoneIds.length === 0) {
      return res.json({
        stats: []
      });
    }

    // Construire la date de début
    const startDate = new Date();
    if (month) startDate.setMonth(parseInt(month) - 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
    endDate.setHours(23, 59, 59, 999);

    // Récupérer les tickets vendus
    const { data: tickets } = await supabaseAdmin
      .from('tickets')
      .select('sold_at')
      .in('wifi_zone_id', zoneIds)
      .eq('status', 'sold')
      .not('sold_at', 'is', null)
      .gte('sold_at', startDate.toISOString())
      .lte('sold_at', endDate.toISOString())
      .order('sold_at', { ascending: true });

    // Grouper par jour
    const dailyStats = {};
    tickets?.forEach(ticket => {
      const date = new Date(ticket.sold_at);
      const dayKey = period === 'days'
        ? `Jour ${date.getDate()}`
        : date.toISOString().split('T')[0];
      
      if (!dailyStats[dayKey]) {
        dailyStats[dayKey] = 0;
      }
      dailyStats[dayKey] += 1;
    });

    res.json({
      stats: Object.entries(dailyStats).map(([day, count]) => ({
        day: day,
        tickets_sold: count
      }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Récupère l'historique des paiements avec commissions
 */
async function getPaymentHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const { 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10,
      search = '',
      zoneId 
    } = req.query;

    // Récupérer toutes les zones de l'utilisateur
    let zoneIds = [];
    if (zoneId) {
      // Vérifier que la zone appartient à l'utilisateur
      const { data: zone } = await supabaseAdmin
        .from('wifi_zones')
        .select('id')
        .eq('id', zoneId)
        .eq('owner_id', userId)
        .single();
      
      if (!zone) {
        return res.status(404).json({ error: 'Wi-Fi zone not found' });
      }
      zoneIds = [zoneId];
    } else {
      const { data: zones } = await supabaseAdmin
        .from('wifi_zones')
        .select('id')
        .eq('owner_id', userId);
      zoneIds = zones?.map(z => z.id) || [];
    }

    if (zoneIds.length === 0) {
      return res.json({
        payments: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0
        }
      });
    }

    // Construire la requête (sans tickets car la relation va dans l'autre sens)
    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        wifi_zones(id, name),
        pricings(amount, name)
      `)
      .in('wifi_zone_id', zoneIds)
      .eq('status', 'completed');

    // Filtres de date
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query = query.gte('completed_at', start.toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('completed_at', end.toISOString());
    }

    // Recherche (par référence de paiement ou numéro de téléphone)
    if (search) {
      query = query.or(`moneroo_payment_id.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    // Compter d'abord le total avec les mêmes filtres (sans relations pour éviter les erreurs)
    let countQuery = supabaseAdmin
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .in('wifi_zone_id', zoneIds)
      .eq('status', 'completed');

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      countQuery = countQuery.gte('completed_at', start.toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      countQuery = countQuery.lte('completed_at', end.toISOString());
    }
    if (search) {
      countQuery = countQuery.or(`moneroo_payment_id.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { count, error: countError } = await countQuery;
    
    if (countError) {
      logger.error('Error counting payments:', countError);
      throw countError;
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: payments, error } = await query
      .order('completed_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('Error fetching payment history:', error);
      throw error;
    }

    // Récupérer les tickets associés séparément (la relation va de tickets vers payments)
    const paymentIds = payments?.map(p => p.id) || [];
    let ticketsMap = {};
    
    if (paymentIds.length > 0) {
      const { data: tickets, error: ticketsError } = await supabaseAdmin
        .from('tickets')
        .select('id, username, password, payment_id')
        .in('payment_id', paymentIds);
      
      if (!ticketsError && tickets) {
        // Créer un map pour accéder rapidement aux tickets par payment_id
        tickets.forEach(ticket => {
          if (ticket.payment_id) {
            if (!ticketsMap[ticket.payment_id]) {
              ticketsMap[ticket.payment_id] = [];
            }
            ticketsMap[ticket.payment_id].push({
              id: ticket.id,
              username: ticket.username,
              password: ticket.password
            });
          }
        });
      }
    }

    // Calculer les commissions et revenus
    const paymentsWithCommission = payments?.map(payment => {
      const amount = parseFloat(payment.amount || 0);
      // Le XOF n'a pas de subdivision: l'agregateur facture en francs entiers.
      const commission = commissionOn(amount);
      const revenue = amount - commission;

      return {
        ...payment,
        commission_rate: COMMISSION_RATE * 100,
        commission: commission,
        revenue: revenue,
        pricing_amount: payment.pricings?.amount || amount,
        // Le tarif fige sur le paiement fait foi: sa ligne pricings a pu etre
        // supprimee depuis la vente (voir migration 007).
        pricing_name: payment.pricing_name || payment.pricings?.name || null,
        zone_name: payment.wifi_zones?.name || 'N/A',
        network: 'MTN MoMo Benin', // À récupérer depuis Moneroo si disponible
        ticket: ticketsMap[payment.id]?.[0] || null
      };
    }) || [];

    res.json({
      payments: paymentsWithCommission,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Exporte l'historique des paiements en CSV
 */
async function exportPaymentHistoryCSV(req, res, next) {
  try {
    const userId = req.user.id;
    const { startDate, endDate, zoneId } = req.query;

    // Récupérer toutes les zones de l'utilisateur
    let zoneIds = [];
    if (zoneId) {
      const { data: zone } = await supabaseAdmin
        .from('wifi_zones')
        .select('id')
        .eq('id', zoneId)
        .eq('owner_id', userId)
        .single();
      
      if (!zone) {
        return res.status(404).json({ error: 'Wi-Fi zone not found' });
      }
      zoneIds = [zoneId];
    } else {
      const { data: zones } = await supabaseAdmin
        .from('wifi_zones')
        .select('id')
        .eq('owner_id', userId);
      zoneIds = zones?.map(z => z.id) || [];
    }

    if (zoneIds.length === 0) {
      return res.status(400).json({ error: 'No zones found' });
    }

    // Construire la requête (sans tickets car la relation va dans l'autre sens)
    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        wifi_zones(id, name),
        pricings(amount, name)
      `)
      .in('wifi_zone_id', zoneIds)
      .eq('status', 'completed');

    if (startDate) {
      query = query.gte('completed_at', new Date(startDate).toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('completed_at', end.toISOString());
    }

    const { data: payments, error } = await query
      .order('completed_at', { ascending: false });

    if (error) {
      logger.error('Error fetching payments for CSV export:', error);
      throw error;
    }

    // Récupérer les tickets associés séparément pour l'export CSV
    const paymentIds = payments?.map(p => p.id) || [];
    let ticketsMap = {};
    
    if (paymentIds.length > 0) {
      const { data: tickets, error: ticketsError } = await supabaseAdmin
        .from('tickets')
        .select('id, username, password, payment_id')
        .in('payment_id', paymentIds);
      
      if (!ticketsError && tickets) {
        tickets.forEach(ticket => {
          if (ticket.payment_id) {
            if (!ticketsMap[ticket.payment_id]) {
              ticketsMap[ticket.payment_id] = [];
            }
            ticketsMap[ticket.payment_id].push({
              id: ticket.id,
              username: ticket.username,
              password: ticket.password
            });
          }
        });
      }
    }

    // Générer le CSV
    const headers = [
      'WIFIZONE',
      'TARIF',
      'REVENU',
      'COMMISSION',
      'RÉFÉRENCE DE PAIEMENT',
      'DATE/HEURE',
      'RÉSEAU',
      'NUMÉRO'
    ];

    const rows = payments?.map(payment => {
      const amount = parseFloat(payment.amount || 0);
      // Le XOF n'a pas de subdivision: l'agregateur facture en francs entiers.
      const commission = commissionOn(amount);
      const revenue = amount - commission;
      const pricingAmount = payment.pricings?.amount || amount;
      const date = new Date(payment.completed_at).toLocaleString('fr-FR');

      return [
        payment.wifi_zones?.name || 'N/A',
        `${pricingAmount} XOF`,
        `${revenue.toFixed(2)} XOF`,
        `${parseFloat((COMMISSION_RATE * 100).toFixed(1))} %`,
        payment.moneroo_payment_id || 'N/A',
        date,
        'MTN MoMo Benin',
        payment.phone || 'N/A'
      ];
    }) || [];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="recettes_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\ufeff' + csvContent); // BOM pour Excel
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPaymentStats,
  getTicketsSoldStats,
  getPaymentHistory,
  exportPaymentHistoryCSV
};

