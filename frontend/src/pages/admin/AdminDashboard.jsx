import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Users, Wallet, TrendingUp, Clock, ArrowUpRight, AlertCircle } from 'lucide-react';
import { getTenants, getWithdrawals } from '../../services/admin';
import { SkeletonHeader, SkeletonStats, SkeletonList } from '../../components/Skeleton';

export default function AdminDashboard() {
  const [tenants, setTenants] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tenantsData, withdrawalsData] = await Promise.all([
        getTenants(),
        getWithdrawals('pending'),
      ]);
      setTenants(tenantsData.tenants || []);
      setPending(withdrawalsData.withdrawals || []);
    } catch (error) {
      console.error('[AdminDashboard] Erreur:', error);
      toast.error(error.message || 'Impossible de charger la vue plateforme');
    } finally {
      setLoading(false);
    }
  };

  const card =
    'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  if (loading) {
    return (
      <div className="space-y-5 md:space-y-6 w-full">
        <SkeletonHeader action={false} />
        <SkeletonStats count={4} />
        <SkeletonList rows={4} />
      </div>
    );
  }

  const totals = tenants.reduce(
    (acc, t) => ({
      gross: acc.gross + (t.gross_volume || 0),
      margin: acc.margin + (t.platform_margin || 0),
      owed: acc.owed + (t.balance?.available || 0),
      sales: acc.sales + (t.sales_count || 0),
    }),
    { gross: 0, margin: 0, owed: 0, sales: 0 }
  );

  const activeTenants = tenants.filter((t) => t.is_active).length;
  const waitingApproval = tenants.filter((t) => !t.is_active);
  const pendingTotal = pending.reduce((s, w) => s + parseFloat(w.amount || 0), 0);

  return (
    <div className="space-y-5 md:space-y-6 w-full">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Vue plateforme
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          L'activité de Fô-Zône en un coup d'œil
        </p>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 bg-gradient-to-br from-lime-400 to-lime-500 dark:from-lime-400 dark:to-lime-600 shadow-lg shadow-lime-500/20">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-[#0A1005]/70">Marge nette</p>
            <TrendingUp className="text-[#0A1005]" size={16} strokeWidth={2.5} />
          </div>
          <p className="text-2xl md:text-[28px] leading-none font-bold text-[#0A1005] tracking-tight">
            {totals.margin.toLocaleString()}
            <span className="text-sm font-bold ml-1.5">XOF</span>
          </p>
          <p className="text-xs text-[#0A1005]/70 font-medium mt-2">Agrégateur déduit</p>
        </div>

        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Volume traité</p>
            <ArrowUpRight className="text-lime-600 dark:text-lime-400" size={16} strokeWidth={2.5} />
          </div>
          <p className="text-2xl md:text-[28px] leading-none font-bold text-gray-900 dark:text-white tracking-tight">
            {totals.gross.toLocaleString()}
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 ml-1.5">XOF</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {totals.sales} ticket{totals.sales > 1 ? 's' : ''} vendu{totals.sales > 1 ? 's' : ''}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Promoteurs</p>
            <Users className="text-lime-600 dark:text-lime-400" size={16} strokeWidth={2.5} />
          </div>
          <p className="text-2xl md:text-[28px] leading-none font-bold text-gray-900 dark:text-white tracking-tight">
            {activeTenants}
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 ml-1.5">
              / {tenants.length}
            </span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {waitingApproval.length > 0
              ? `${waitingApproval.length} en attente de validation`
              : 'Tous actifs'}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Dû aux promoteurs</p>
            <Wallet className="text-lime-600 dark:text-lime-400" size={16} strokeWidth={2.5} />
          </div>
          <p className="text-2xl md:text-[28px] leading-none font-bold text-gray-900 dark:text-white tracking-tight">
            {totals.owed.toLocaleString()}
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 ml-1.5">XOF</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Soldes non retirés</p>
        </div>
      </div>

      {/* Ce qui demande une action */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Retraits à traiter */}
        <div className={`${card} p-5 md:p-6`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                Retraits à traiter
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {pending.length === 0
                  ? 'Rien en attente'
                  : `${pendingTotal.toLocaleString()} XOF à valider`}
              </p>
            </div>
            <Link
              to="/admin/withdrawals"
              className="text-xs font-semibold text-lime-700 dark:text-lime-400 hover:text-lime-600 dark:hover:text-lime-300 transition-colors inline-flex items-center gap-1"
            >
              Voir tout
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {pending.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-3">
                <Clock className="text-lime-600 dark:text-lime-400" size={22} strokeWidth={2} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Aucune demande en attente
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/5 -mx-1">
              {pending.slice(0, 5).map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 px-1 py-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900 dark:text-white">
                      {parseFloat(w.amount).toLocaleString()} XOF
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {w.users?.full_name || w.users?.email} · {formatDate(w.requested_at)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400 flex-shrink-0">
                    <Clock size={12} strokeWidth={2.5} />
                    En attente
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comptes à valider */}
        <div className={`${card} p-5 md:p-6`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                Comptes à valider
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Inscriptions en attente d'activation
              </p>
            </div>
            <Link
              to="/admin/tenants"
              className="text-xs font-semibold text-lime-700 dark:text-lime-400 hover:text-lime-600 dark:hover:text-lime-300 transition-colors inline-flex items-center gap-1"
            >
              Voir tout
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {waitingApproval.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-3">
                <Users className="text-lime-600 dark:text-lime-400" size={22} strokeWidth={2} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Aucun compte en attente
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/5 -mx-1">
              {waitingApproval.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-1 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                      {t.full_name || t.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t.email}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400 flex-shrink-0">
                    <AlertCircle size={12} strokeWidth={2.5} />
                    En attente
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
