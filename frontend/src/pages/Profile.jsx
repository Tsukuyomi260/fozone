import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { User, Edit3, Lock, Shield, Save, X, Eye, EyeOff, Users, Trash2, UserPlus } from 'lucide-react';
import { getProfile, updateProfile, changePassword } from '../services/profile';
import { getTeam, addMember, removeMember } from '../services/team';
import { getCurrentUser } from '../services/auth';
import toast from 'react-hot-toast';
import { Skeleton, SkeletonCard } from '../components/Skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Profile() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // État pour l'édition du profil
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: ''
  });

  // État pour le changement de mot de passe
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // État pour l'équipe: comptes partageant les mêmes données
  const [team, setTeam] = useState([]);
  const [canManageTeam, setCanManageTeam] = useState(true);
  const [teamLoading, setTeamLoading] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [memberForm, setMemberForm] = useState({
    email: '',
    password: '',
    full_name: ''
  });

  const loadTeam = async () => {
    try {
      setTeamLoading(true);
      const response = await getTeam();
      setTeam(response.members || []);
      setCanManageTeam(response.can_manage);
    } catch (error) {
      console.error('[Profile] Erreur équipe:', error);
      toast.error(error.message || "Impossible de charger l'équipe");
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'team') loadTeam();
  }, [activeTab]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      setAddingMember(true);
      const response = await addMember(
        memberForm.email,
        memberForm.password,
        memberForm.full_name
      );
      toast.success(response.message);
      setMemberForm({ email: '', password: '', full_name: '' });
      loadTeam();
    } catch (error) {
      toast.error(error.message || "Impossible d'ajouter ce membre");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (member) => {
    if (
      !window.confirm(
        `Retirer l'accès de ${member.email} ? Son compte restera, mais il ne verra plus vos données.`
      )
    ) {
      return;
    }

    try {
      const response = await removeMember(member.membership_id);
      toast.success(response.message);
      loadTeam();
    } catch (error) {
      toast.error(error.message || 'Opération impossible');
    }
  };
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    loadProfile();
    setCurrentUser(getCurrentUser());
  }, []);

  // Détecter l'onglet depuis l'URL
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && ['overview', 'edit', 'password', 'security'].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await getProfile();
      setUser(response.user);
      setEditForm({
        full_name: response.user.full_name || '',
        email: response.user.email || '',
        phone: response.user.phone || ''
      });
    } catch (error) {
      // Logger les détails techniques uniquement en console
      console.error('[Profile] Erreur lors du chargement:', error);
      // Message user-friendly
      toast.error(error.message || 'Impossible de charger votre profil');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const response = await updateProfile(editForm);
      setUser(response.user);
      setCurrentUser({ ...currentUser, ...response.user });
      localStorage.setItem('user', JSON.stringify(response.user));
      toast.success('Profil mis à jour avec succès !');
      setActiveTab('overview');
    } catch (error) {
      // Logger les détails techniques uniquement en console
      console.error('[Profile] Erreur lors de la mise à jour:', error);
      // Message user-friendly
      toast.error(error.message || 'Impossible de mettre à jour votre profil');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      setSaving(true);
      await changePassword(passwordForm.current_password, passwordForm.new_password);
      toast.success('Mot de passe modifié avec succès !');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
      setActiveTab('overview');
    } catch (error) {
      // Logger les détails techniques uniquement en console
      console.error('[Profile] Erreur lors du changement de mot de passe:', error);
      // Message user-friendly
      toast.error(error.message || 'Impossible de modifier le mot de passe');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const tabs = [
    { id: 'overview', label: 'Aperçu', icon: User },
    { id: 'edit', label: 'Éditer le Profil', icon: Edit3 },
    { id: 'password', label: 'Changer le Mot de Passe', icon: Lock },
    { id: 'team', label: 'Équipe', icon: Users },
    { id: 'security', label: 'Sécurité 2FA', icon: Shield }
  ];

  if (loading) {
    return (
      <div className="space-y-5 md:space-y-6 w-full">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <SkeletonCard className="p-5 md:p-6 flex items-center gap-5">
          <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </SkeletonCard>
        <SkeletonCard className="p-5 md:p-6 space-y-4">
          <Skeleton className="h-9 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    );
  }

  const card =
    'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';

  return (
    <div className="space-y-5 md:space-y-6 w-full">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Mon Profil
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Vos informations personnelles et votre sécurité
        </p>
      </div>

      {/* Carte de profil utilisateur */}
      <div className={`${card} p-5 md:p-6`}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-lime-400 flex items-center justify-center text-[#0A1005] text-xl font-extrabold flex-shrink-0">
            {getInitials(user?.full_name || user?.email || 'U')}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {user?.full_name || user?.email || 'Utilisateur'}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {user?.role && (
                <span className="inline-block px-2.5 py-1 text-[11px] font-bold rounded-full bg-lime-50 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400">
                  {user.role === 'admin' ? 'Administrateur' : user.role}
                </span>
              )}
              {user?.email && (
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className={card}>
        <div className="p-2 overflow-x-auto">
          <nav className="flex gap-1 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-lime-400 text-[#0A1005]'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={16} strokeWidth={2.2} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Contenu des onglets */}
        <div className="p-6 md:p-8">
          {/* Onglet Aperçu */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-6">
                Détails du Profil
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nom
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white">
                    {user?.full_name?.split(' ')[0] || 'Non renseigné'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prénom
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white">
                    {user?.full_name?.split(' ').slice(1).join(' ') || 'Non renseigné'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white">
                    {user?.email || 'Non renseigné'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Téléphone
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white">
                    {user?.phone || 'Non renseigné'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rôle
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white">
                    {user?.role === 'admin' ? 'Administrateur' : user?.role || 'Non renseigné'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date de création
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white">
                    {user?.created_at
                      ? format(new Date(user.created_at), 'dd MMMM yyyy', { locale: fr })
                      : 'Non renseigné'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Onglet Éditer le Profil */}
          {activeTab === 'edit' && (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-6">
                Modifier vos informations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 transition-colors"
                    placeholder="Votre nom complet"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 transition-colors"
                    placeholder="votre@email.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Numéro de téléphone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 transition-colors"
                    placeholder="+229 XX XX XX XX"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-[#0A1005]/30 border-t-[#0A1005] animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save size={18} strokeWidth={2} />
                      Enregistrer les modifications
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditForm({
                      full_name: user?.full_name || '',
                      email: user?.email || '',
                      phone: user?.phone || ''
                    });
                    setActiveTab('overview');
                  }}
                  className="btn btn-secondary inline-flex items-center gap-2"
                >
                  <X size={18} strokeWidth={2} />
                  Annuler
                </button>
              </div>
            </form>
          )}

          {/* Onglet Changer le Mot de Passe */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-6">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-6">
                Modifier votre mot de passe
              </h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mot de passe actuel
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      id="current_password"
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                      className="w-full h-11 px-3.5 pr-10 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 transition-colors"
                      placeholder="Entrez votre mot de passe actuel"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      id="new_password"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      className="w-full h-11 px-3.5 pr-10 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 transition-colors"
                      placeholder="Entrez votre nouveau mot de passe"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Le mot de passe doit contenir au moins 6 caractères
                  </p>
                </div>
                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirmer le nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      id="confirm_password"
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      className="w-full h-11 px-3.5 pr-10 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 transition-colors"
                      placeholder="Confirmez votre nouveau mot de passe"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-[#0A1005]/30 border-t-[#0A1005] animate-spin" />
                      Modification...
                    </>
                  ) : (
                    <>
                      <Save size={18} strokeWidth={2} />
                      Modifier le mot de passe
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordForm({
                      current_password: '',
                      new_password: '',
                      confirm_password: ''
                    });
                    setActiveTab('overview');
                  }}
                  className="btn btn-secondary inline-flex items-center gap-2"
                >
                  <X size={18} strokeWidth={2} />
                  Annuler
                </button>
              </div>
            </form>
          )}

          {/* Onglet Équipe */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                  Équipe
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Les personnes ajoutées ici travaillent sur vos zones, vos tickets et
                  votre comptabilité, avec leur propre identifiant. Le solde est commun.
                </p>
              </div>

              {!canManageTeam && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Vous avez accès à ce compte en tant que membre. Seul le propriétaire
                    peut gérer l'équipe.
                  </p>
                </div>
              )}

              {/* Formulaire d'ajout */}
              {canManageTeam && (
                <form onSubmit={handleAddMember} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                        Email
                      </label>
                      <input
                        type="email"
                        required
                        value={memberForm.email}
                        onChange={(e) =>
                          setMemberForm({ ...memberForm, email: e.target.value })
                        }
                        placeholder="associe@email.com"
                        className="w-full h-11 px-3.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                        Nom complet
                      </label>
                      <input
                        type="text"
                        value={memberForm.full_name}
                        onChange={(e) =>
                          setMemberForm({ ...memberForm, full_name: e.target.value })
                        }
                        placeholder="Nom de votre associé"
                        className="w-full h-11 px-3.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      value={memberForm.password}
                      onChange={(e) =>
                        setMemberForm({ ...memberForm, password: e.target.value })
                      }
                      placeholder="Au moins 6 caractères"
                      className="w-full h-11 px-3.5 rounded-xl text-sm bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-lime-400/60 focus:ring-2 focus:ring-lime-400/15 transition-colors"
                    />
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      Nécessaire uniquement si la personne n'a pas encore de compte
                      Fô-Zône. Communiquez-le-lui, il pourra le changer ensuite.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={addingMember}
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-bold bg-lime-400 hover:bg-lime-300 text-[#0A1005] rounded-xl shadow-lg shadow-lime-400/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingMember ? (
                      <>
                        <span className="h-4 w-4 rounded-full border-2 border-[#0A1005]/30 border-t-[#0A1005] animate-spin" />
                        Ajout...
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} strokeWidth={2.5} />
                        Donner l'accès
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Liste des membres */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                  {team.length === 0
                    ? 'Aucun membre'
                    : `${team.length} membre${team.length > 1 ? 's' : ''}`}
                </p>

                {teamLoading ? (
                  <Skeleton className="h-16 w-full rounded-xl" />
                ) : team.length === 0 ? (
                  <div className="text-center py-8 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-3">
                      <Users className="text-lime-600 dark:text-lime-400" size={22} strokeWidth={2} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Vous êtes seul sur ce compte
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {team.map((member) => (
                      <div
                        key={member.membership_id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-lime-400 flex items-center justify-center flex-shrink-0 text-[#0A1005] font-bold text-xs">
                            {(member.full_name || member.email || 'U')
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {member.full_name || member.email?.split('@')[0]}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {member.email}
                            </p>
                          </div>
                        </div>
                        {canManageTeam && (
                          <button
                            onClick={() => handleRemoveMember(member)}
                            className="p-2 rounded-lg text-gray-400 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
                            title="Retirer l'accès"
                          >
                            <Trash2 size={16} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Onglet Sécurité 2FA */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-6">
                Authentification à deux facteurs (2FA)
              </h3>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <Shield className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" size={24} strokeWidth={2} />
                  <div>
                    <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      Sécurité renforcée
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                      L'authentification à deux facteurs ajoute une couche supplémentaire de sécurité à votre compte.
                      Cette fonctionnalité sera disponible prochainement.
                    </p>
                    <button
                      disabled
                      className="btn btn-secondary opacity-50 cursor-not-allowed"
                    >
                      Activer la 2FA (Bientôt disponible)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

