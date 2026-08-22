/**
 * Squelettes de chargement.
 *
 * Un spinner ne dit rien de ce qui arrive; un squelette dessine la page a
 * l'avance, donc l'oeil se place avant meme que les donnees soient la et le
 * basculement ne fait pas sauter la mise en page.
 */

const base = 'animate-pulse rounded-lg bg-gray-200 dark:bg-white/[0.06]';

export function Skeleton({ className = '' }) {
  return <div className={`${base} ${className}`} />;
}

const cardShell =
  'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#101714] shadow-sm dark:shadow-black/30';

export function SkeletonCard({ className = '', children }) {
  return <div className={`${cardShell} ${className}`}>{children}</div>;
}

/** En-tête de page: titre + sous-titre, et une action a droite. */
export function SkeletonHeader({ action = true }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-36" />
      </div>
      {action && <Skeleton className="h-11 w-36 rounded-xl" />}
    </div>
  );
}

/** Rangée d'indicateurs chiffrés. */
export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          <Skeleton className="h-7 w-28 mb-3" />
          <Skeleton className="h-3 w-20" />
        </SkeletonCard>
      ))}
    </div>
  );
}

/** Liste de lignes: icône, deux lignes de texte, chevron. */
export function SkeletonList({ rows = 4, className = '' }) {
  return (
    <div className={`divide-y divide-gray-100 dark:divide-white/5 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-3.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
            <div className="space-y-2 min-w-0 flex-1">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
          <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Grille de cartes, pour les pages qui listent des éléments. */
export function SkeletonGrid({ count = 6, columns = 'md:grid-cols-2 xl:grid-cols-3' }) {
  return (
    <div className={`grid grid-cols-1 ${columns} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="space-y-2.5 mb-5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-3 w-28" />
        </SkeletonCard>
      ))}
    </div>
  );
}

/** Tableau: en-tête puis lignes. */
export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <SkeletonCard className="p-5 md:p-6">
      <div className="flex gap-4 pb-4 mb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 py-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3.5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}

export default Skeleton;
