/**
 * Seuil d'alerte de stock de tickets.
 *
 * En dessous de ce nombre de tickets libres, le tarif remonte dans la cloche
 * de notification du promoteur. L'objectif est qu'il reimporte avant la
 * rupture: une fois a zero, le forfait est grise sur la page d'achat et ne
 * rapporte plus rien.
 */
const LOW_STOCK_THRESHOLD = 10;

module.exports = { LOW_STOCK_THRESHOLD };
