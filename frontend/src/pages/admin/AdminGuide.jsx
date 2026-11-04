import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  BookOpen, Copy, Check, MessageCircle, Smartphone,
  RefreshCw, KeyRound, Unlock, Ban, Plus,
} from 'lucide-react';
import {
  getLicences, creerAcces, revoquerAcces, libererAppareils,
  oublierMotDePasse, regenererExemplaire, getAppareils,
} from '../../services/guide';
import { SkeletonHeader, SkeletonTable } from '../../components/Skeleton';

const FORMULAIRE_VIDE = {
  prenom: '', nom: '', pays: 'BJ', telephone: '',
  montant: '', provenance: 'chariow', note: '', max_appareils: 2,
};

const CANAUX = {
  chariow: 'Chariow',
  whatsapp: 'WhatsApp',
  especes: 'Espèces',
  offert: 'Offert',
  autre: 'Autre',
};

export default function AdminGuide() {
  const [licences, setLicences] = useState([]);
  const [pays, setPays] = useState([]);
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(FORMULAIRE_VIDE);
  const [creation, setCreation] = useState(false);
  const [dernier, setDernier] = useState(null);
  const [copie, setCopie] = useState(false);

  const [acting, setActing] = useState(null);
  const [appareils, setAppareils] = useState(null);

  useEffect(() => {
    charger();
  }, []);

  const charger = async () => {
    try {
      const reponse = await getLicences();
      setLicences(reponse.licences || []);
      setPays(reponse.pays || []);
      setResume(reponse.resume || null);
    } catch (error) {
      console.error('[AdminGuide] Erreur:', error);
      toast.error(error.message || 'Impossible de charger les accès');
    } finally {
      setLoading(false);
    }
  };

  const paysChoisi = pays.find((p) => p.code === form.pays);

  const creer = async (e) => {
    e.preventDefault();
    if (!form.prenom.trim() && !form.nom.trim()) {
      toast.error('Il faut au moins un prénom ou un nom.');
      return;
    }

    setCreation(true);
    try {
      const reponse = await creerAcces({
        ...form,
        montant: form.montant === '' ? null : Number(form.montant),
      });
      toast.success(reponse.message);
      setDernier(reponse.licence);
      setCopie(false);
      setForm({ ...FORMULAIRE_VIDE, pays: form.pays, provenance: form.provenance });
      charger();
    } catch (error) {
      toast.error(error.message || "L'accès n'a pas pu être créé");
    } finally {
      setCreation(false);
    }
  };

  const copier = async (texte) => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      toast.success('Lien copié');
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error('Copie impossible, sélectionne le lien à la main');
    }
  };

  /** Ouvre WhatsApp avec le message déjà écrit. */
  const messageWhatsapp = (licence) => {
    const prenom = licence.prenom || licence.nom || '';
    const texte =
      `Bonjour ${prenom},\n\n` +
      `Voici ton accès personnel au guide « Lancer sa Wi-Fi Zone » :\n${licence.lien}\n\n` +
      `À ta première ouverture, tu choisiras un mot de passe. ` +
      `Ton accès fonctionne sur ${licence.max_appareils} appareils au maximum ` +
      `(ton téléphone et ton ordinateur, par exemple).\n\n` +
      `Cet exemplaire porte ton nom sur chaque page : ne le partage pas.`;

    const numero = (licence.telephone || '').replace(/\D/g, '');
    return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
  };

  const agir = async (licence, action, fn, confirmation) => {
    if (confirmation && !window.confirm(confirmation)) return;
    setActing(licence.id + action);
    try {
      const reponse = await fn(licence.id);
      toast.success(reponse.message);
      charger();
    } catch (error) {
      toast.error(error.message || 'Opération impossible');
    } finally {
      setActing(null);
    }
  };

  const voirAppareils = async (licence) => {
    setActing(licence.id + 'appareils');
    try {
      const reponse = await getAppareils(licence.id);
      setAppareils({ licence, ...reponse });
    } catch (error) {
      toast.error(error.message || 'Lecture impossible');
    } finally {
      setActing(null);
    }
  };

  const card =
    'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';
  const th =
    'px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap';
  const td = 'px-4 py-3 text-sm whitespace-nowrap';
  const champ =
    'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0C1210] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-400/50';
  const etiquette = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5';

  /** L'état d'une licence en un coup d'œil. */
  const etatDe = (l) => {
    if (l.revoquee) return { label: 'Révoqué', className: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' };
    if (!l.mot_de_passe_pose) return { label: 'Jamais ouvert', className: 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400' };
    return { label: 'Actif', className: 'bg-lime-50 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400' };
  };

  if (loading) {
    return (
      <div className="space-y-5 md:space-y-6 w-full">
        <SkeletonHeader action={false} />
        <SkeletonTable rows={5} cols={7} />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 w-full">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Guide
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {licences.length === 0
            ? 'Aucun accès généré'
            : `${licences.length} accès générés`}
        </p>
      </div>

      {/* Totaux */}
      {resume && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`${card} p-5`}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Accès actifs</p>
            <p className="text-2xl leading-none font-bold text-gray-900 dark:text-white tracking-tight">
              {resume.actives}
            </p>
          </div>
          <div className={`${card} p-5`}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Jamais ouverts</p>
            <p className="text-2xl leading-none font-bold text-gray-900 dark:text-white tracking-tight">
              {resume.jamais_ouvertes}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-wide">
              Mot de passe non posé
            </p>
          </div>
          <div className="rounded-2xl p-5 bg-gradient-to-br from-lime-400 to-lime-500 dark:from-lime-400 dark:to-lime-600 shadow-lg shadow-lime-500/20">
            <p className="text-xs font-medium text-[#0A1005]/70 mb-3">Chiffre du guide</p>
            <p className="text-2xl leading-none font-bold text-[#0A1005] tracking-tight">
              {(resume.chiffre || 0).toLocaleString()}
              <span className="text-sm font-bold ml-1.5">XOF</span>
            </p>
          </div>
          <div className={`${card} p-5`}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Révoqués</p>
            <p className="text-2xl leading-none font-bold text-gray-900 dark:text-white tracking-tight">
              {resume.revoquees}
            </p>
          </div>
        </div>
      )}

      {/* Nouvel accès */}
      <form onSubmit={creer} className={`${card} p-5 md:p-6 space-y-4`}>
        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-400/10">
            <Plus className="text-lime-600 dark:text-lime-400" size={18} strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Nouvel accès</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              La référence est calculée toute seule
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={etiquette} htmlFor="prenom">Prénom</label>
            <input id="prenom" className={champ} value={form.prenom} placeholder="Boubacar"
              onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
          </div>
          <div>
            <label className={etiquette} htmlFor="nom">Nom</label>
            <input id="nom" className={champ} value={form.nom} placeholder="BAH"
              onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div>
            <label className={etiquette} htmlFor="pays">Pays</label>
            <select id="pays" className={champ} value={form.pays}
              onChange={(e) => setForm({ ...form, pays: e.target.value })}>
              {pays.map((p) => (
                <option key={p.code} value={p.code}>{p.nom} (+{p.indicatif})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiquette} htmlFor="tel">
              Téléphone {paysChoisi && (
                <span className="text-gray-400">· {paysChoisi.chiffres} chiffres</span>
              )}
            </label>
            <input id="tel" className={champ} value={form.telephone}
              placeholder={paysChoisi ? paysChoisi.exemple : ''}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
          </div>
          <div>
            <label className={etiquette} htmlFor="montant">Montant payé</label>
            <input id="montant" className={champ} type="number" min="0" value={form.montant}
              placeholder="0" onChange={(e) => setForm({ ...form, montant: e.target.value })} />
          </div>
          <div>
            <label className={etiquette} htmlFor="provenance">Provenance</label>
            <select id="provenance" className={champ} value={form.provenance}
              onChange={(e) => setForm({ ...form, provenance: e.target.value })}>
              {Object.entries(CANAUX).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiquette} htmlFor="appareils">Appareils autorisés</label>
            <input id="appareils" className={champ} type="number" min="1" max="10"
              value={form.max_appareils}
              onChange={(e) => setForm({ ...form, max_appareils: Number(e.target.value) })} />
          </div>
          <div>
            <label className={etiquette} htmlFor="note">Note</label>
            <input id="note" className={champ} value={form.note} placeholder="N° de commande…"
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>

        <button type="submit" disabled={creation}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 disabled:opacity-50 text-[#0A1005] text-sm font-semibold transition-colors">
          {creation ? 'Génération…' : "Générer l'accès"}
        </button>
      </form>

      {/* Le lien qui vient d'être créé */}
      {dernier && (
        <div className={`${card} p-5 md:p-6 border-lime-300 dark:border-lime-400/30`}>
          <div className="flex items-center gap-2 mb-3">
            <Check className="text-lime-600 dark:text-lime-400" size={18} strokeWidth={2.6} />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {dernier.reference} · {[dernier.prenom, dernier.nom].filter(Boolean).join(' ')}
            </p>
          </div>

          <p className="text-xs font-mono break-all text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3 mb-3">
            {dernier.lien}
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copier(dernier.lien)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold">
              {copie ? <Check size={15} strokeWidth={2.6} /> : <Copy size={15} strokeWidth={2.4} />}
              {copie ? 'Copié' : 'Copier le lien'}
            </button>

            {dernier.telephone && (
              <a href={messageWhatsapp(dernier)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-lime-400 hover:bg-lime-300 text-[#0A1005] text-sm font-semibold transition-colors">
                <MessageCircle size={15} strokeWidth={2.4} />
                Envoyer sur WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      {/* Tableau */}
      {licences.length === 0 ? (
        <div className={`${card} text-center py-16 px-6`}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lime-50 dark:bg-lime-400/10 mb-4">
            <BookOpen className="text-lime-600 dark:text-lime-400" size={26} strokeWidth={2} />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Aucun accès généré
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Remplis le formulaire ci-dessus pour créer le premier.
          </p>
        </div>
      ) : (
        <div className={`${card} p-5 md:p-6`}>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/[0.03]">
                <tr>
                  <th className={th}>RÉFÉRENCE</th>
                  <th className={th}>TITULAIRE</th>
                  <th className={th}>MONTANT</th>
                  <th className={th}>OUVERTURES</th>
                  <th className={th}>APPAREILS</th>
                  <th className={th}>ÉTAT</th>
                  <th className={th}>ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {licences.map((l) => {
                  const etat = etatDe(l);
                  const occupe = acting && acting.startsWith(l.id);
                  return (
                    <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className={`${td} font-mono text-xs text-gray-500 dark:text-gray-400`}>
                        {l.reference}
                      </td>
                      <td className={td}>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {[l.prenom, l.nom].filter(Boolean).join(' ')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{l.telephone || '—'}</p>
                      </td>
                      <td className={`${td} text-gray-900 dark:text-white`}>
                        {l.montant ? `${l.montant.toLocaleString()} ${l.devise}` : '—'}
                        {l.provenance && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{CANAUX[l.provenance]}</p>
                        )}
                      </td>
                      <td className={`${td} text-gray-900 dark:text-white tabular-nums`}>{l.ouvertures}</td>
                      <td className={`${td} tabular-nums`}>
                        <button type="button" onClick={() => voirAppareils(l)} disabled={occupe}
                          className="text-gray-900 dark:text-white hover:text-lime-600 dark:hover:text-lime-400 inline-flex items-center gap-1.5">
                          <Smartphone size={14} strokeWidth={2.2} />
                          {l.appareils} / {l.max_appareils}
                        </button>
                      </td>
                      <td className={td}>
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${etat.className}`}>
                          {etat.label}
                        </span>
                      </td>
                      <td className={td}>
                        <div className="flex items-center gap-1">
                          <button type="button" title="Copier le lien"
                            onClick={() => copier(l.lien)} disabled={occupe}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400">
                            <Copy size={15} strokeWidth={2.2} />
                          </button>
                          {l.telephone && (
                            <a href={messageWhatsapp(l)} target="_blank" rel="noreferrer" title="Envoyer sur WhatsApp"
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400">
                              <MessageCircle size={15} strokeWidth={2.2} />
                            </a>
                          )}
                          <button type="button" title="Libérer les appareils" disabled={occupe}
                            onClick={() => agir(l, 'liberer', libererAppareils,
                              `Libérer les appareils de ${l.reference} ? Il pourra en réenregistrer ${l.max_appareils} avec son mot de passe.`)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400">
                            <Unlock size={15} strokeWidth={2.2} />
                          </button>
                          <button type="button" title="Effacer le mot de passe" disabled={occupe}
                            onClick={() => agir(l, 'mdp', oublierMotDePasse,
                              `Effacer le mot de passe de ${l.reference} ? Il en choisira un nouveau à sa prochaine ouverture.`)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400">
                            <KeyRound size={15} strokeWidth={2.2} />
                          </button>
                          <button type="button" title="Remettre à jour depuis le guide actuel" disabled={occupe}
                            onClick={() => agir(l, 'regen', regenererExemplaire)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400">
                            <RefreshCw size={15} strokeWidth={2.2} />
                          </button>
                          <button type="button" title={l.revoquee ? 'Rétablir' : 'Révoquer'} disabled={occupe}
                            onClick={() => agir(l, 'revoc', revoquerAcces,
                              l.revoquee
                                ? `Rétablir l'accès de ${l.reference} ?`
                                : `Couper l'accès de ${l.reference} ? Son lien cessera de fonctionner.`)}
                            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 ${
                              l.revoquee ? 'text-lime-600 dark:text-lime-400' : 'text-red-500'
                            }`}>
                            <Ban size={15} strokeWidth={2.2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Appareils d'un exemplaire */}
      {appareils && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
          onClick={() => setAppareils(null)}>
          <div className={`${card} w-full max-w-lg p-5 md:p-6`} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              Appareils de {[appareils.licence.prenom, appareils.licence.nom].filter(Boolean).join(' ')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {appareils.max} autorisés · {appareils.licence.reference}
            </p>

            {appareils.appareils.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
                Aucun appareil : le lien n'a jamais été ouvert.
              </p>
            ) : (
              <ul className="space-y-2 mb-4">
                {appareils.appareils.map((a) => (
                  <li key={a.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04]">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {a.etiquette || 'Appareil'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Depuis le {String(a.premiere_vue).slice(0, 10)} · vu le {String(a.derniere_vue).slice(0, 10)}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-lg text-xs font-semibold ${
                      a.libere
                        ? 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400'
                        : 'bg-lime-50 dark:bg-lime-400/10 text-lime-700 dark:text-lime-400'
                    }`}>
                      {a.libere ? 'Libéré' : 'Actif'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <button type="button" onClick={() => setAppareils(null)}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-sm font-semibold text-gray-700 dark:text-gray-200">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
