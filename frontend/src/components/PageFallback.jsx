/**
 * Affiché pendant le téléchargement du code d'une page, à la première visite
 * seulement : le navigateur garde ensuite le fichier en cache.
 */
export default function PageFallback({ fullScreen = false }) {
  return (
    <div
      className={`flex items-center justify-center ${
        fullScreen ? 'min-h-screen bg-gray-50 dark:bg-[#080B0A]' : 'min-h-[40vh]'
      }`}
    >
      <span className="h-8 w-8 rounded-full border-2 border-lime-400/30 border-t-lime-400 animate-spin" />
    </div>
  );
}
