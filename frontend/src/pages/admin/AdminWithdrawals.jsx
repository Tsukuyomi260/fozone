import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, XCircle, Wallet, Phone } from 'lucide-react';
import {
  getWithdrawals,
  approveWithdrawal,
  markWithdrawalPaid,
  rejectWithdrawal,
} from '../../services/admin';
import { SkeletonHeader, SkeletonList } from '../../components/Skeleton';

const STATUS = {
  pending: { label: 'En attente', icon: Clock, className: 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400' },
  approved: { label: 'Validé', icon: CheckCircle, className: 'bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-400' },
  paid: { label: 'Payé', icon: CheckCircle, className: 'bg-lime-50 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400' },
  rejected: { label: 'Refusé', icon: XCircle, className: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
};

const FILTERS = [
  { value: 'pending', label: 'À traiter' },
  { value: 'approved', label: 'Virement à faire' },
  { value: 'paid', label: 'Payés' },
  { value: '', label: 'Tous' },
];

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [acting, setActing] = useState(null);

  useEffect(() => {
    loadWithdrawals();
  }, [filter]);

  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      const response = await getWithdrawals(filter);
      setWithdrawals(response.withdrawals || []);
    } catch (error) {
      console.error('[AdminWithdrawals] Erreur:', error);
      toast.error(error.message || 'Impossible de charger les retraits');
    } finally {
      setLoading(false);
    }
  };

  const act = async (id, fn, confirmMessage, needsNote) => {
    let note;
    if (needsNote) {
      note = window.prompt(confirmMessage);
      // prompt annulé : ne rien faire. Une chaîne vide reste un refus valide.
      if (note === null) return;
    } else if (!window.confirm(confirmMessage)) {
      return;
    }

    setActing(id);
    try {
      const response = await fn(id, note);
      toast.success(response.message || 'Retrait mis à jour');
      loadWithdrawals();
    } catch (error) {
      toast.error(error.message || 'Opération impossible');
    } finally {
      setActing(null);
    }
  };

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const card =
    'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';

  const actionBtn =
    'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-5 md:space-y-6 w-full">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Retraits
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Demandes de versement des promoteurs
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
              filter === f.value
                ? 'bg-lime-400 text-[#0A1005]'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <>
          <SkeletonHeader action={false} />
          <SkeletonList rows={5} />
        </>
      ) : withdrawals.length === 0 ? (
        <div className={`${card} text-center py-16 px-6`}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-4">
            <Wallet className="text-lime-600 dark:text-lime-400" size={26} strokeWidth={2} />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Aucune demande
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Rien à traiter dans cette catégorie
          </p>
        </div>
      ) : (
        <div className={`${card} p-5 md:p-6`}>
          <div className="divide-y divide-gray-100 dark:divide-white/5 -mx-1">
            {withdrawals.map((w) => {
              const meta = STATUS[w.status] || STATUS.pending;
              const StatusIcon = meta.icon;
              const busy = acting === w.id;

              return (
                <div key={w.id} className="px-1 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-lg text-gray-900 dark:text-white">
                          {parseFloat(w.amount).toLocaleString()} XOF
                        </p>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.className}`}
                        >
                          <StatusIcon size={12} strokeWidth={2.5} />
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {w.users?.full_name || w.users?.email || 'Promoteur inconnu'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-500">
                        <Phone size={12} strokeWidth={2} />
                        <span className="font-mono">{w.payout_phone}</span>
                        <span>·</span>
                        <span>{formatDate(w.requested_at)}</span>
                      </div>
                      {w.note && (
                        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1.5 italic">
                          {w.note}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {w.status === 'pending' && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() =>
                              act(w.id, approveWithdrawal, `Valider le retrait de ${parseFloat(w.amount).toLocaleString()} XOF ?`, false)
                            }
                            className={`${actionBtn} bg-lime-400 hover:bg-lime-300 text-[#0A1005]`}
                          >
                            Valider
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              act(w.id, rejectWithdrawal, 'Motif du refus :', true)
                            }
                            className={`${actionBtn} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}
                          >
                            Refuser
                          </button>
                        </>
                      )}

                      {w.status === 'approved' && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() =>
                              act(w.id, markWithdrawalPaid, `Confirmer que le virement de ${parseFloat(w.amount).toLocaleString()} XOF a bien été envoyé ?`, false)
                            }
                            className={`${actionBtn} bg-lime-400 hover:bg-lime-300 text-[#0A1005]`}
                          >
                            Virement envoyé
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              act(w.id, rejectWithdrawal, 'Motif de l\'annulation :', true)
                            }
                            className={`${actionBtn} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {w.status === 'approved' && (
                    <p className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-400/10 rounded-lg px-3 py-2">
                      Fonds engagés — effectuez le virement Mobile Money, puis confirmez.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
