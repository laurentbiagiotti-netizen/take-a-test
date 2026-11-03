"use client";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Épreuve en pause : le candidat filme la pièce à 360° avec son téléphone.
 * Le chrono est gelé côté serveur ; l'épreuve reprend dès que la vidéo est reçue.
 */
export function RoomScanOverlay({ getLink }: { getLink: () => Promise<{ url?: string; error?: string }> }) {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const r = await getLink();
    if (!r.url) { setError(r.error || "Impossible de créer le QR code, réessayez."); return; }
    setUrl(r.url);
    setQr(await QRCode.toDataURL(r.url, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#0b0e16", light: "#ffffff" } }));
  }, [getLink]);

  useEffect(() => { load(); }, [load]);
  // Le lien expire au bout de 30 minutes : on le renouvelle avant
  useEffect(() => { const i = setInterval(load, 20 * 60 * 1000); return () => clearInterval(i); }, [load]);

  return (
    <div className="fixed inset-0 z-[54] bg-bg/95 flex items-center justify-center p-6 overflow-auto" role="alertdialog" aria-labelledby="scan-title" aria-describedby="scan-desc">
      <div className="card max-w-3xl w-full grid md:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <div className="text-xs uppercase tracking-wider text-warn font-semibold">Épreuve en pause · chrono arrêté</div>
          <h2 id="scan-title" className="h1 mt-2">Filmez la pièce avec votre téléphone</h2>
          <div id="scan-desc" className="text-sm text-muted mt-3 space-y-3">
            <p>Plusieurs avertissements ont été relevés. Pour reprendre, montrez au surveillant l&apos;endroit où vous composez.</p>
            <ol className="list-decimal pl-5 space-y-1.5 text-fg/90">
              <li>Scannez le QR code avec l&apos;appareil photo du téléphone.</li>
              <li>Autorisez la caméra, puis tournez lentement sur vous-même : murs, bureau, dessous du bureau, porte.</li>
              <li>Terminez par l&apos;écran et le clavier de cet ordinateur, puis touchez « Envoyer ».</li>
            </ol>
            <p>L&apos;épreuve reprend seule dès la vidéo reçue, avec le temps de la pause rendu. Pas de téléphone ? Écrivez au surveillant (bouton en bas à gauche).</p>
            <p className="text-xs text-faint">La vidéo n&apos;est vue que par l&apos;équipe de surveillance et elle est supprimée avec les autres données de surveillance.</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          {qr ? <img src={qr} alt="QR code à scanner avec votre téléphone" className="w-60 h-60 rounded-lg bg-white p-2" />
            : <div className="w-60 h-60 rounded-lg bg-surface-2 flex items-center justify-center text-sm text-muted">{error ? "QR code indisponible" : "Création du QR code…"}</div>}
          {error && <p className="text-danger text-xs text-center" role="alert">{error}</p>}
          <button className="btn-secondary !py-1 text-xs" onClick={load}>Nouveau QR code</button>
          {url && <span className="sr-only">{url}</span>}
        </div>
      </div>
    </div>
  );
}
