/**
 * Marque FÔ-ZÔNE, purement typographique.
 * Pas de pictogramme: le nom se suffit, comme sur les interfaces sombres
 * dont s'inspire le thème. `className` pilote la couleur du texte, le
 * séparateur suit en transparence pour rester lisible sur tout fond.
 */
export default function Logo({ className = '', size = 'md' }) {
  const sizeClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  return (
    <span
      className={`inline-flex items-baseline font-extrabold tracking-tight leading-none select-none ${sizeClasses[size]} ${className}`}
    >
      FÔ
      <span className="opacity-30 mx-[0.12em] font-light">/</span>
      ZÔNE
    </span>
  );
}
