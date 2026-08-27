import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../services/auth';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import Logo from '../components/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await login(email, password);
      toast.success('Connexion réussie !');
      // Le super-admin n'a aucune zone a lui: il atterrit sur son propre
      // espace, jamais melange au dashboard promoteur.
      navigate(response.user?.role === 'super_admin' ? '/admin' : '/dashboard');
    } catch (error) {
      console.error('[Login] Erreur:', error);
      toast.error(error.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  const field =
    'w-full h-12 pl-11 rounded-xl text-[15px] bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 focus:bg-white dark:focus:bg-white/[0.06] transition-colors';

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
            Connectez-vous à votre espace de gestion
          </p>
        </div>

        {/* Formulaire */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/40 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-400 dark:text-gray-600 pointer-events-none"
                  strokeWidth={2}
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={field}
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                >
                  Mot de passe
                </label>
                <Link
                  to="#"
                  className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-lime-600 dark:hover:text-lime-400 transition-colors"
                >
                  Oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-400 dark:text-gray-600 pointer-events-none"
                  strokeWidth={2}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
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
                </button>
              </div>
            </div>

            {/* Bouton de connexion */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-1 inline-flex items-center justify-center gap-2 text-[15px] font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-[#0A1005]/30 border-t-[#0A1005] animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight size={17} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Lien d'inscription */}
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Pas encore de compte ?{' '}
          <Link
            to="/register"
            className="font-semibold text-lime-700 dark:text-lime-400 hover:text-lime-600 dark:hover:text-lime-300 transition-colors"
          >
            Créez-en un
          </Link>
        </p>
      </div>
    </div>
  );
}
