import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getGlobalStats } from '../services/dashboard';
import { getWifiZones } from '../services/wifiZones';
import toast from 'react-hot-toast';
import { Wifi, DollarSign, Ticket, TrendingUp, MapPin, ArrowUpRight, BarChart3 } from 'lucide-react';
import { SkeletonHeader, SkeletonStats, SkeletonCard, SkeletonList, Skeleton } from '../components/Skeleton';

/**
 * Jauge circulaire: reprend le principe de l'objectif chiffre du dashboard
 * de reference. Le trace est un cercle dont on anime le dash-offset.
 */
function Gauge({ value, total }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          className="stroke-gray-200 dark:stroke-white/10"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-lime-500 dark:stroke-lime-400 transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900 dark:text-white">
        {pct}%
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, zonesData] = await Promise.all([
        getGlobalStats(),
        getWifiZones(),
      ]);
      setStats(statsData.stats);
      setZones(zonesData.zones || []);
    } catch (error) {
      console.error('[Dashboard] Erreur:', error);
      toast.error(error.message || 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5 md:space-y-6 w-full">
        <SkeletonHeader action={false} />
        <SkeletonStats count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonCard className="lg:col-span-2 p-5 md:p-6">
            <Skeleton className="h-5 w-32 mb-5" />
            <SkeletonList rows={4} />
          </SkeletonCard>
          <SkeletonCard className="p-6 space-y-4">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </SkeletonCard>
        </div>
      </div>
    );
  }

  const todayTickets = stats?.today_tickets_sold || 0;
  // Le net est calcule par l API a partir du taux partage avec la comptabilite
  const todayNet = stats?.today_revenue_net ?? stats?.today_revenue ?? 0;
  const activeZones = stats?.active_zones || 0;
  const totalZones = stats?.total_zones || 0;

  const statCards = [
    {
      title: 'Chiffre d\'affaires total',
      value: `${(stats?.total_revenue || 0).toLocaleString()}`,
      unit: 'XOF',
      hint: 'Depuis le début',
      icon: DollarSign,
    },
    {
      title: 'Tickets vendus',
      value: (stats?.total_tickets_sold || 0).toLocaleString(),
      unit: '',
      hint: 'Toutes zones confondues',
      icon: Ticket,
    },
    {
      title: 'Recettes du jour',
      value: `${todayNet.toLocaleString()}`,
      unit: 'XOF',
      hint: `Net · ${todayTickets} ticket${todayTickets > 1 ? 's' : ''} aujourd'hui`,
      icon: TrendingUp,
      // Le chiffre du jour est celui qu'on regarde en premier: il porte l'accent
      accent: true,
    },
  ];

  const card = 'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';

  // Aplat lime, comme l'encart du jour: c'est le chiffre qu'on regarde en premier
  const cardAccent =
    'rounded-2xl bg-gradient-to-br from-lime-400 to-lime-500 dark:from-lime-400 dark:to-lime-600 shadow-lg shadow-lime-500/20';

  return (
    <div className="space-y-5 md:space-y-6 w-full">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Vue d'ensemble
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Votre activité en un coup d'œil
          </p>
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300">
          <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse"></span>
          Aujourd'hui
        </span>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`${stat.accent ? cardAccent : card} p-5 transition-colors ${
                stat.accent ? '' : 'hover:border-lime-400/40 dark:hover:border-lime-400/30'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <p className={`text-xs font-medium ${
                  stat.accent
                    ? 'text-[#0A1005]/70'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {stat.title}
                </p>
                <Icon className={stat.accent ? 'text-[#0A1005]' : 'text-lime-600 dark:text-lime-400'} size={16} strokeWidth={2.5} />
              </div>
              <p className={`text-2xl md:text-[28px] leading-none font-bold tracking-tight break-words ${
                stat.accent
                  ? 'text-[#0A1005]'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {stat.value}
                {stat.unit && (
                  <span className={`text-sm font-semibold ml-1.5 ${
                    stat.accent
                      ? 'text-[#0A1005]/60'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {stat.unit}
                  </span>
                )}
              </p>
              <p className={`text-xs mt-2 ${
                stat.accent
                  ? 'text-[#0A1005]/70 font-medium'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {stat.hint}
              </p>
            </div>
          );
        })}

        {/* Zones actives, avec jauge */}
        <div className={`${card} p-5 transition-colors hover:border-lime-400/40 dark:hover:border-lime-400/30`}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Zones actives</p>
            <Wifi className="text-lime-600 dark:text-lime-400" size={16} strokeWidth={2.5} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl md:text-[28px] leading-none font-bold text-gray-900 dark:text-white tracking-tight">
                {activeZones}
                <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 ml-1.5">
                  / {totalZones}
                </span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {totalZones === 0 ? 'Aucune zone' : 'Zones en service'}
              </p>
            </div>
            <Gauge value={activeZones} total={totalZones} />
          </div>
        </div>
      </div>

      {/* Zones + encart du jour */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Liste des zones */}
        <div className={`${card} lg:col-span-2 p-5 md:p-6`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Zones Wi-Fi
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Vos points d'accès
              </p>
            </div>
            <Link
              to="/zones"
              className="text-xs font-semibold text-lime-700 dark:text-lime-400 hover:text-lime-600 dark:hover:text-lime-300 transition-colors inline-flex items-center gap-1"
            >
              Voir tout
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {zones.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-4">
                <MapPin className="text-lime-600 dark:text-lime-400" size={26} strokeWidth={2} />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Aucune zone Wi-Fi
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
                Commencez par créer votre première zone
              </p>
              <Link
                to="/zones"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-lime-400 hover:bg-lime-300 text-[#0A1005] text-sm font-bold rounded-xl shadow-lg shadow-lime-400/20 transition-colors"
              >
                <Wifi size={16} strokeWidth={2.5} />
                Créer une zone
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/5 -mx-1">
              {zones.slice(0, 5).map((zone) => (
                <Link
                  key={zone.id}
                  to={`/zones/${zone.id}`}
                  className="flex items-center justify-between gap-3 px-1 py-3.5 group rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-lime-50 dark:bg-lime-400/10 flex items-center justify-center">
                      <Wifi className="text-lime-600 dark:text-lime-400" size={17} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {zone.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {zone.router_ip}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight
                    className="text-gray-300 dark:text-gray-600 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors flex-shrink-0"
                    size={17}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Encart lime: la recette du jour */}
        <div className="rounded-2xl p-6 flex flex-col justify-between bg-gradient-to-br from-lime-400 to-lime-500 dark:from-lime-400 dark:to-lime-600 shadow-lg shadow-lime-500/20">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0A1005]/10 text-[#0A1005] text-[11px] font-bold mb-5">
              <TrendingUp size={12} strokeWidth={3} />
              Aujourd'hui
            </span>
            <p className="text-4xl font-extrabold text-[#0A1005] tracking-tight leading-none">
              {todayNet.toLocaleString()}
              <span className="text-base font-bold ml-1.5">XOF</span>
            </p>
            <p className="text-[11px] font-semibold text-[#0A1005]/50 mt-1.5 uppercase tracking-wide">
              Net, commission déduite
            </p>
            <p className="text-sm text-[#0A1005]/70 font-medium mt-3">
              {todayTickets === 0
                ? 'Aucun ticket vendu pour l\'instant'
                : `${todayTickets} ticket${todayTickets > 1 ? 's' : ''} vendu${todayTickets > 1 ? 's' : ''} depuis ce matin`}
            </p>
          </div>
          <Link
            to="/accounting"
            className="mt-6 inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-[#0A1005] text-lime-300 text-sm font-bold hover:bg-[#0A1005]/90 transition-colors"
          >
            <BarChart3 size={16} strokeWidth={2.5} />
            Voir la comptabilité
          </Link>
        </div>
      </div>
    </div>
  );
}
