import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/auth';
import toast from 'react-hot-toast';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import Logo from '../components/Logo';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Erreur affichée dans la carte, pas en toast: un toast disparaît avant
  // qu'on ait fini de le lire et passe mal aux lecteurs d'écran.
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await register(formData.email.trim(), formData.password, formData.full_name);
      toast.success('Inscription réussie !');
      navigate('/dashboard');
    } catch (err) {
      console.error('[Register] Erreur:', err);
      setError(err.message || 'Impossible de créer le compte');
    } finally {
      setLoading(false);
    }
  };

  const field =
    'w-full h-12 pl-11 rounded-xl text-[15px] bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 focus:bg-white dark:focus:bg-white/[0.06] transition-colors';

  const label =
    'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide';

  const icon =
    'absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-400 dark:text-gray-600 pointer-events-none';

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 bg-gray-50 dark:bg-[#080B0A] overflow-hidden">
      {/* Halo vert, comme sur le portail captif */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-100"
        style={{
          background:
            'radial-gradient(70% 45% at 50% -5%, rgba(163, 230, 53, 0.16), transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-[400px]">
        {/* Marque */}
        <div className="text-center mb-8">
          <Logo size="xl" className="text-gray-900 dark:text-white" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            Créez votre compte et commencez à vendre vos tickets Wi-Fi
          </p>
        </div>

        {/* Formulaire */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/40 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nom complet */}
            <div>
              <label htmlFor="full_name" className={label}>
                Nom complet
              </label>
              <div className="relative">
                <User className={icon} strokeWidth={2} aria-hidden="true" />
                <input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  autoComplete="name"
                  className={field}
                  placeholder="Jean Dossou"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className={label}>
                Email
              </label>
              <div className="relative">
                <Mail className={icon} strokeWidth={2} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoComplete="email"
                  className={field}
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className={label}>
                Mot de passe
              </label>
              <div className="relative">
                <Lock className={icon} strokeWidth={2} aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  aria-describedby="password-hint"
                  className={`${field} pr-11`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" strokeWidth={2} />
                  )}
                  <span className="sr-only">
                    {showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  </span>
                </button>
              </div>
              <p
                id="password-hint"
                className="mt-2 text-xs text-gray-500 dark:text-gray-400"
              >
                Minimum 6 caractères
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-400"
              >
                {error}
              </p>
            )}

            {/* Bouton d'inscription */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-1 inline-flex items-center justify-center gap-2 text-[15px] font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#101714]"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-[#0A1005]/30 border-t-[#0A1005] animate-spin" />
                  Inscription...
                </>
              ) : (
                <>
                  S'inscrire
                  <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Lien de connexion */}
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Déjà un compte ?{' '}
          <Link
            to="/login"
            className="font-semibold text-lime-700 dark:text-lime-400 hover:text-lime-600 dark:hover:text-lime-300 transition-colors"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
