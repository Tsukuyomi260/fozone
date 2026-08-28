import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Users, Wifi } from 'lucide-react';
import { getTenants, setTenantActive } from '../../services/admin';
import { SkeletonHeader, SkeletonTable } from '../../components/Skeleton';

export default function AdminTenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const response = await getTenants();
      setTenants(response.tenants || []);
    } catch (error) {
      console.error('[AdminTenants] Erreur:', error);
      toast.error(error.message || 'Impossible de charger les promoteurs');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (tenant) => {
    const next = !tenant.is_active;
    const message = next
      ? `Activer ${tenant.email} ? Il pourra créer des zones et vendre des tickets.`
      : `Désactiver ${tenant.email} ? Il ne pourra plus se connecter ni vendre.`;

    if (!window.confirm(message)) return;

    setActing(tenant.id);
    try {
      const response = await setTenantActive(tenant.id, next);
      toast.success(response.message);
      loadTenants();
    } catch (error) {
      toast.error(error.message || 'Opération impossible');
    } finally {
      setActing(null);
    }
  };

  const card =
    'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';

  const th =
    'px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap';
  const td = 'px-4 py-3 text-sm whitespace-nowrap';

  // Totaux plateforme, calcules sur les lignes affichees
  const totals = tenants.reduce(
    (acc, t) => ({
      gross: acc.gross + (t.gross_volume || 0),
      fees: acc.fees + (t.platform_fees || 0),
      margin: acc.margin + (t.platform_margin || 0),
      owed: acc.owed + (t.balance?.available || 0),
    }),
    { gross: 0, fees: 0, margin: 0, owed: 0 }
  );

  if (loading) {
    return (
      <div className="space-y-5 md:space-y-6 w-full">
        <SkeletonHeader action={false} />
        <SkeletonTable rows={5} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 w-full">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Promoteurs
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {tenants.length === 0
            ? 'Aucun promoteur inscrit'
            : `${tenants.length} compte${tenants.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Totaux plateforme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${card} p-5`}>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Volume brut</p>
          <p className="text-2xl leading-none font-bold text-gray-900 dark:text-white tracking-tight">
            {totals.gross.toLocaleString()}
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 ml-1.5">XOF</span>
          </p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Commission 5%</p>
          <p className="text-2xl leading-none font-bold text-gray-900 dark:text-white tracking-tight">
            {totals.fees.toLocaleString()}
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 ml-1.5">XOF</span>
          </p>
        </div>
        <div className="rounded-2xl p-5 bg-gradient-to-br from-lime-400 to-lime-500 dark:from-lime-400 dark:to-lime-600 shadow-lg shadow-lime-500/20">
          <p className="text-xs font-medium text-[#0A1005]/70 mb-3">Marge nette</p>
          <p className="text-2xl leading-none font-bold text-[#0A1005] tracking-tight">
            {totals.margin.toLocaleString()}
            <span className="text-sm font-bold ml-1.5">XOF</span>
          </p>
          <p className="text-[10px] font-semibold text-[#0A1005]/50 mt-2 uppercase tracking-wide">
            Agrégateur déduit
          </p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Dû aux promoteurs</p>
          <p className="text-2xl leading-none font-bold text-gray-900 dark:text-white tracking-tight">
            {totals.owed.toLocaleString()}
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 ml-1.5">XOF</span>
          </p>
        </div>
      </div>

      {/* Tableau */}
      {tenants.length === 0 ? (
        <div className={`${card} text-center py-16 px-6`}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-4">
            <Users className="text-lime-600 dark:text-lime-400" size={26} strokeWidth={2} />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Aucun promoteur
          </p>
        </div>
      ) : (
        <div className={`${card} p-5 md:p-6`}>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/[0.03]">
                <tr>
                  <th className={th}>PROMOTEUR</th>
                  <th className={th}>ZONES</th>
                  <th className={th}>VENTES</th>
                  <th className={th}>VOLUME BRUT</th>
                  <th className={th}>COMMISSION</th>
                  <th className={th}>SOLDE DÛ</th>
                  <th className={th}>STATUT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                    <td className={td}>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {t.full_name || t.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t.email}</p>
                    </td>
                    <td className={`${td} text-gray-600 dark:text-gray-400`}>
                      <span className="inline-flex items-center gap-1.5">
                        <Wifi size={13} className="text-lime-600 dark:text-lime-400" strokeWidth={2.5} />
                        {t.zones}
                      </span>
                    </td>
                    <td className={`${td} text-gray-600 dark:text-gray-400`}>{t.sales_count}</td>
                    <td className={`${td} font-semibold text-gray-900 dark:text-white`}>
                      {(t.gross_volume || 0).toLocaleString()} XOF
                    </td>
                    <td className={`${td} text-lime-700 dark:text-lime-400 font-semibold`}>
                      {(t.platform_fees || 0).toLocaleString()} XOF
                    </td>
                    <td className={`${td} font-bold text-gray-900 dark:text-white`}>
                      {(t.balance?.available || 0).toLocaleString()} XOF
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            t.is_active
                              ? 'bg-lime-50 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400'
                              : 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {t.is_active ? 'Actif' : 'En attente'}
                        </span>
                        <button
                          disabled={acting === t.id}
                          onClick={() => toggleActive(t)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 ${
                            t.is_active
                              ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                              : 'bg-lime-400 hover:bg-lime-300 text-[#0A1005]'
                          }`}
                        >
                          {t.is_active ? 'Désactiver' : 'Activer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
