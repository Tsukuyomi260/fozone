import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Wallet as WalletIcon, ArrowUpRight, Clock, CheckCircle, XCircle, Send } from 'lucide-react';
import { getBalance, getMyWithdrawals, requestWithdrawal } from '../services/wallet';
import { getCurrentUser } from '../services/auth';
import { SkeletonHeader, SkeletonStats, SkeletonList } from '../components/Skeleton';

const STATUS = {
  pending: { label: 'En attente', icon: Clock, className: 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400' },
  approved: { label: 'Validé', icon: CheckCircle, className: 'bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-400' },
  paid: { label: 'Payé', icon: CheckCircle, className: 'bg-lime-50 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400' },
  rejected: { label: 'Refusé', icon: XCircle, className: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
};

export default function Wallet() {
  const [balance, setBalance] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [balanceData, withdrawalsData] = await Promise.all([
        getBalance(),
        getMyWithdrawals(),
      ]);
      setBalance(balanceData.balance);
      setWithdrawals(withdrawalsData.withdrawals || []);
      // Pré-remplir avec le numéro du profil, modifiable avant envoi
      const user = getCurrentUser();
      if (user?.phone) setPhone(user.phone);
    } catch (error) {
      console.error('[Wallet] Erreur:', error);
      toast.error(error.message || 'Impossible de charger votre solde');
    } finally {
      setLoading(false);
    }
  };

  const normalizePhone = (value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length === 8 ? `229${digits}` : digits;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const requested = parseFloat(amount);
    if (!requested || requested <= 0) {
      toast.error('Saisissez un montant valide');
      return;
    }
    if (requested > (balance?.available || 0)) {
      toast.error('Montant supérieur à votre solde disponible');
      return;
    }
    if (normalizePhone(phone).length < 8) {
      toast.error('Saisissez un numéro Mobile Money valide');
      return;
    }

    setSubmitting(true);
    try {
      await requestWithdrawal(requested, normalizePhone(phone));
      toast.success('Demande enregistrée, en attente de validation');
      setAmount('');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Impossible d\'enregistrer la demande');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  if (loading) {
    return (
      <div className="space-y-5 md:space-y-6 w-full">
        <SkeletonHeader action={false} />
        <SkeletonStats count={3} />
        <SkeletonList rows={4} />
      </div>
    );
  }

  const card =
    'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';

  const field =
    'w-full h-11 px-3.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 transition-colors';

  const hasPending = withdrawals.some((w) => w.status === 'pending');

  return (
    <div className="space-y-5 md:space-y-6 w-full">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Solde & Retraits
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Vos gains nets et vos demandes de versement
        </p>
      </div>

      {/* Solde disponible en relief */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl p-6 bg-gradient-to-br from-lime-400 to-lime-500 dark:from-lime-400 dark:to-lime-600 shadow-lg shadow-lime-500/20">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0A1005]/10 text-[#0A1005] text-[11px] font-bold mb-4">
            <WalletIcon size={12} strokeWidth={3} />
            Disponible
          </span>
          <p className="text-4xl font-extrabold text-[#0A1005] tracking-tight leading-none">
            {(balance?.available || 0).toLocaleString()}
            <span className="text-base font-bold ml-1.5">XOF</span>
          </p>
          <p className="text-[11px] font-semibold text-[#0A1005]/50 mt-2 uppercase tracking-wide">
            Net, commission déduite
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-4">
            Total gagné
          </p>
          <p className="text-2xl md:text-[28px] leading-none font-bold text-gray-900 dark:text-white tracking-tight">
            {(balance?.earned || 0).toLocaleString()}
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 ml-1.5">XOF</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Depuis le début</p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-4">
            Déjà versé
          </p>
          <p className="text-2xl md:text-[28px] leading-none font-bold text-gray-900 dark:text-white tracking-tight">
            {(balance?.withdrawn || 0).toLocaleString()}
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 ml-1.5">XOF</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {(balance?.pending || 0) > 0
              ? `${(balance.pending).toLocaleString()} XOF en cours de virement`
              : 'Aucun virement en cours'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Demande de retrait */}
        <div className={`${card} p-5 md:p-6`}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight mb-1">
            Demander un retrait
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
            Versé sur votre compte Mobile Money après validation
          </p>

          {hasPending ? (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 p-4">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                Demande en cours
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/70">
                Une nouvelle demande sera possible une fois celle-ci traitée.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Montant
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  max={balance?.available || 0}
                  className={field}
                />
                <button
                  type="button"
                  onClick={() => setAmount(String(balance?.available || 0))}
                  className="mt-1.5 text-xs font-semibold text-lime-700 dark:text-lime-400 hover:text-lime-600 dark:hover:text-lime-300 transition-colors"
                >
                  Tout retirer ({(balance?.available || 0).toLocaleString()} XOF)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  Numéro Mobile Money
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="97 00 00 00"
                  className={field}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || (balance?.available || 0) <= 0}
                className="w-full h-11 inline-flex items-center justify-center gap-2 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-[#0A1005]/30 border-t-[#0A1005] animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Send size={16} strokeWidth={2.5} />
                    Demander le retrait
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Historique */}
        <div className={`${card} lg:col-span-2 p-5 md:p-6`}>
          <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight mb-1">
            Historique
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
            {withdrawals.length === 0
              ? 'Aucune demande pour le moment'
              : `${withdrawals.length} demande${withdrawals.length > 1 ? 's' : ''}`}
          </p>

          {withdrawals.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-4">
                <ArrowUpRight className="text-lime-600 dark:text-lime-400" size={26} strokeWidth={2} />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Aucun retrait
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Vos demandes apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-white/5 -mx-1">
              {withdrawals.map((w) => {
                const meta = STATUS[w.status] || STATUS.pending;
                const StatusIcon = meta.icon;
                return (
                  <div key={w.id} className="flex items-center justify-between gap-3 px-1 py-3.5">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 dark:text-white">
                        {parseFloat(w.amount).toLocaleString()} XOF
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatDate(w.requested_at)} · {w.payout_phone}
                      </p>
                      {w.note && (
                        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 italic">
                          {w.note}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0 ${meta.className}`}
                    >
                      <StatusIcon size={12} strokeWidth={2.5} />
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
