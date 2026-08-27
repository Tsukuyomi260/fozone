/**
 * Placeholder: la vue plateforme (liste des promoteurs, volume, retraits en
 * attente) arrive avec la fonctionnalite retraits. Cette page existe pour
 * que le squelette de routes /admin soit reel et testable des maintenant.
 */
export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
        Vue plateforme
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Bientôt : promoteurs, volume par tenant, retraits à valider.
      </p>
    </div>
  );
}
