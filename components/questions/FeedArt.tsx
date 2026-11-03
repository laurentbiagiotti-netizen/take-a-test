"use client";
/* Illustrations (SVG dessinés ici, aucune image externe) et faux sites web ouverts depuis le fil « vrai ou fake ». */
import type { ReactNode } from "react";
import type { Site } from "@/lib/questions/feed";

const Frame = ({ children, bg }: { children: ReactNode; bg: string }) => (
  <svg viewBox="0 0 400 225" className="w-full h-auto block" role="img" aria-hidden style={{ background: bg }}>{children}</svg>
);

export const ART: Record<string, () => JSX.Element> = {
  identite: () => (
    <Frame bg="#dbeafe">
      <rect x="70" y="40" width="260" height="150" rx="12" fill="#eff6ff" stroke="#93c5fd" strokeWidth="3" />
      <rect x="70" y="40" width="260" height="26" rx="12" fill="#1d4ed8" /><text x="200" y="58" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">CARTE NATIONALE D&apos;IDENTITÉ</text>
      <rect x="88" y="80" width="70" height="88" rx="6" fill="#cbd5e1" /><circle cx="123" cy="110" r="16" fill="#94a3b8" /><rect x="101" y="130" width="44" height="30" rx="14" fill="#94a3b8" />
      {["NOM : MARTIN", "Prénom : Léa", "Né(e) le : 14.03.2009", "N° : 23AB45678"].map((t, i) => <text key={t} x="172" y={96 + i * 20} fontSize="12" fill="#1e293b" fontFamily="monospace">{t}</text>)}
    </Frame>
  ),
  coucher: () => (
    <Frame bg="#fb923c">
      <rect x="0" y="0" width="400" height="140" fill="#fdba74" /><circle cx="200" cy="140" r="50" fill="#fde047" />
      <rect x="0" y="140" width="400" height="85" fill="#1e3a8a" />{[155, 170, 185, 200].map((y) => <rect key={y} x={200 - (y - 140)} y={y} width={2 * (y - 140)} height="3" fill="#fde047" opacity=".6" />)}
    </Frame>
  ),
  maison: () => (
    <Frame bg="#bae6fd">
      <rect x="0" y="180" width="400" height="45" fill="#86efac" /><rect x="110" y="95" width="180" height="90" fill="#fef3c7" /><polygon points="95,100 200,40 305,100" fill="#b91c1c" />
      <rect x="185" y="130" width="34" height="55" fill="#78350f" /><rect x="128" y="115" width="38" height="30" fill="#93c5fd" /><rect x="236" y="115" width="38" height="30" fill="#93c5fd" />
      <rect x="226" y="150" width="36" height="22" rx="3" fill="#1e40af" /><text x="244" y="166" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">12</text>
      <rect x="20" y="160" width="80" height="22" rx="3" fill="#1e3a8a" /><text x="60" y="175" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">Rue des Lilas</text>
    </Frame>
  ),
  chat: () => (
    <Frame bg="#fce7f3">
      <ellipse cx="200" cy="160" rx="110" ry="45" fill="#f9a8d4" /><ellipse cx="200" cy="150" rx="80" ry="40" fill="#78716c" />
      <circle cx="270" cy="130" r="32" fill="#78716c" /><polygon points="250,105 258,80 270,102" fill="#78716c" /><polygon points="282,102 292,80 296,106" fill="#78716c" />
      <path d="M258 130 q6 5 12 0 M276 130 q6 5 12 0" stroke="#1c1917" strokeWidth="3" fill="none" /><text x="320" y="90" fontSize="22" fill="#9d174d">z z</text>
    </Frame>
  ),
  billet: () => (
    <Frame bg="#e0f2fe">
      <rect x="50" y="55" width="300" height="115" rx="10" fill="#fff" stroke="#7dd3fc" strokeWidth="3" /><rect x="50" y="55" width="300" height="26" rx="10" fill="#0369a1" />
      <text x="62" y="73" fontSize="12" fontWeight="700" fill="#fff">CARTE D&apos;EMBARQUEMENT</text>
      <text x="70" y="115" fontSize="26" fontWeight="800" fill="#0c4a6e">LIL → BCN</text>
      <text x="70" y="140" fontSize="12" fill="#334155" fontFamily="monospace">MARTIN/LEA · VOL VY8814 · 06:00</text>
      {Array.from({ length: 16 }, (_, i) => <rect key={i} x={265 + i * 5} y="98" width={i % 3 ? 2 : 3} height="52" fill="#0f172a" />)}
    </Frame>
  ),
  chien: () => (
    <Frame bg="#fef9c3">
      <rect x="0" y="170" width="400" height="55" fill="#a3e635" /><ellipse cx="200" cy="150" rx="70" ry="40" fill="#d97706" />
      <circle cx="270" cy="115" r="34" fill="#d97706" /><ellipse cx="248" cy="100" rx="12" ry="26" fill="#92400e" /><ellipse cx="294" cy="100" rx="12" ry="26" fill="#92400e" />
      <circle cx="262" cy="112" r="4" fill="#1c1917" /><circle cx="282" cy="112" r="4" fill="#1c1917" /><ellipse cx="272" cy="128" rx="8" ry="5" fill="#1c1917" />
      <rect x="250" y="142" width="44" height="8" rx="4" fill="#dc2626" /><text x="120" y="60" fontSize="18" fontWeight="800" fill="#b45309">Caramel 🐾</text>
    </Frame>
  ),
  phare: () => (
    <Frame bg="#7dd3fc">
      <rect x="0" y="165" width="400" height="60" fill="#0369a1" /><path d="M0 165 q100 -10 200 0 t200 0 v10 H0z" fill="#e0f2fe" opacity=".6" />
      <polygon points="190,165 200,60 220,60 230,165" fill="#fff" /><rect x="196" y="85" width="28" height="12" fill="#dc2626" /><rect x="193" y="120" width="34" height="12" fill="#dc2626" />
      <rect x="198" y="45" width="24" height="16" fill="#facc15" /><polygon points="222,50 330,30 330,70" fill="#fef08a" opacity=".5" />
      <text x="60" y="60" fontSize="18" fontWeight="800" fill="#0c4a6e">QUIMPER</text>
    </Frame>
  ),
  gateau: () => (
    <Frame bg="#fdf2f8">
      <rect x="120" y="120" width="160" height="70" rx="8" fill="#f472b6" /><rect x="120" y="120" width="160" height="16" fill="#fbcfe8" />
      {[150, 185, 215, 250].map((x) => <g key={x}><rect x={x} y="92" width="8" height="28" fill="#60a5fa" /><ellipse cx={x + 4} cy="86" rx="5" ry="8" fill="#fbbf24" /></g>)}
      <text x="200" y="215" textAnchor="middle" fontSize="16" fontWeight="800" fill="#be185d">45 ans !</text>
    </Frame>
  ),
  inondation: () => (
    <Frame bg="#8fa3b5">
      <rect x="0" y="0" width="400" height="120" fill="#9fb2c3" />
      {[[10, 40, 70, 110], [90, 20, 60, 130], [160, 55, 80, 95], [250, 30, 70, 120], [330, 50, 70, 100]].map(([x, y, w, h], i) => (
        <g key={i}><rect x={x} y={y} width={w} height={h} fill={["#6b5b4e", "#7d6a5a", "#5c4f45", "#857261", "#6e6052"][i]} />
          {Array.from({ length: 6 }, (_, k) => <rect key={k} x={x + 8 + (k % 3) * 20} y={y + 12 + Math.floor(k / 3) * 26} width="10" height="14" fill="#c9d6df" opacity=".7" />)}</g>
      ))}
      <rect x="0" y="140" width="400" height="85" fill="#5d7a8c" />
      <path d="M0 140 Q50 132 100 140 T200 140 T300 140 T400 140 V150 H0Z" fill="#7393a6" />
      <g><rect x="60" y="128" width="70" height="24" rx="6" fill="#b23a3a" /><rect x="72" y="118" width="44" height="14" rx="4" fill="#c95252" /><rect x="78" y="121" width="14" height="9" fill="#cfe3ef" /><rect x="96" y="121" width="14" height="9" fill="#cfe3ef" /></g>
      <g><rect x="250" y="131" width="80" height="22" rx="6" fill="#e8e8e8" /><rect x="264" y="121" width="50" height="14" rx="4" fill="#f2f2f2" /><rect x="270" y="124" width="16" height="9" fill="#9cc2d6" /><rect x="291" y="124" width="16" height="9" fill="#9cc2d6" /></g>
      {[30, 170, 360].map((x) => <ellipse key={x} cx={x} cy="175" rx="22" ry="3" fill="#a9c2d1" opacity=".6" />)}
    </Frame>
  ),
  appli_payante: () => (
    <Frame bg="#1b1f2e">
      <rect x="150" y="18" width="100" height="190" rx="16" fill="#2c3247" stroke="#59607a" strokeWidth="3" />
      <rect x="160" y="36" width="80" height="150" rx="6" fill="#3b82f6" />
      <circle cx="200" cy="90" r="24" fill="#fff" opacity=".95" /><path d="M188 90 a12 12 0 0 1 24 0 v10 h-24z" fill="#3b82f6" /><rect x="186" y="96" width="28" height="18" rx="3" fill="#1e3a8a" />
      <text x="200" y="145" textAnchor="middle" fontSize="20" fontWeight="700" fill="#fff">4,99 €</text>
      <text x="200" y="165" textAnchor="middle" fontSize="11" fill="#dbeafe">par mois</text>
      <text x="60" y="70" fontSize="44" fill="#ef4444" fontWeight="900">!</text><text x="320" y="170" fontSize="44" fill="#ef4444" fontWeight="900">!</text>
    </Frame>
  ),
  cadeau: () => (
    <Frame bg="#fff7d6">
      {[[60, 120, -12], [110, 100, 8], [80, 150, 20]].map(([x, y, r], i) => (
        <g key={i} transform={`rotate(${r} ${x} ${y})`}><rect x={x - 55} y={y - 28} width="110" height="56" rx="6" fill="#5aa469" stroke="#3d7a4b" strokeWidth="2" /><circle cx={x} cy={y} r="16" fill="#8fd19e" /><text x={x} y={y + 6} textAnchor="middle" fontSize="16" fontWeight="800" fill="#2f5d3a">500</text></g>
      ))}
      <rect x="230" y="90" width="120" height="100" fill="#e11d48" /><rect x="222" y="70" width="136" height="28" fill="#f43f5e" /><rect x="282" y="70" width="16" height="120" fill="#fde047" />
      <path d="M290 70 C270 40 245 55 268 70 M290 70 C310 40 335 55 312 70" stroke="#fde047" strokeWidth="8" fill="none" />
      <text x="290" y="215" textAnchor="middle" fontSize="15" fontWeight="800" fill="#be123c">GRATUIT !</text>
    </Frame>
  ),
  manette: () => (
    <Frame bg="#ede9fe">
      <path d="M110 110 q-40 0 -50 50 q-6 30 20 32 q16 1 30 -22 h80 q14 23 30 22 q26 -2 20 -32 q-10 -50 -50 -50z" fill="#4c1d95" />
      <circle cx="105" cy="140" r="8" fill="#a78bfa" /><circle cx="205" cy="132" r="6" fill="#f472b6" /><circle cx="220" cy="146" r="6" fill="#34d399" />
      <polyline points="260,180 290,150 315,160 350,100" fill="none" stroke="#16a34a" strokeWidth="8" strokeLinecap="round" /><polygon points="350,85 362,112 336,108" fill="#16a34a" />
      <text x="300" y="70" fontSize="30" fontWeight="800" fill="#7c3aed">+ 20 %</text>
    </Frame>
  ),
  faille: () => (
    <Frame bg="#e8f0fe">
      <rect x="110" y="40" width="180" height="115" rx="8" fill="#1f2937" /><rect x="120" y="50" width="160" height="95" fill="#111827" /><rect x="90" y="155" width="220" height="14" rx="4" fill="#9ca3af" />
      <path d="M200 62 l38 14 v26 c0 22 -16 34 -38 42 c-22 -8 -38 -20 -38 -42 v-26z" fill="#22c55e" /><path d="M184 102 l12 12 l22 -24" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" />
      <text x="200" y="200" textAnchor="middle" fontSize="13" fill="#1f2937">Mise à jour 4.12.1 disponible</text>
    </Frame>
  ),
  video_choc: () => (
    <Frame bg="#0b0b0b">
      <rect x="0" y="0" width="400" height="225" fill="url(#g)" /><defs><radialGradient id="g"><stop offset="0" stopColor="#3a3a3a" /><stop offset="1" stopColor="#050505" /></radialGradient></defs>
      <circle cx="140" cy="100" r="34" fill="#555" opacity=".7" /><rect x="105" y="135" width="70" height="80" rx="30" fill="#555" opacity=".7" />
      <circle cx="270" cy="105" r="30" fill="#444" opacity=".7" /><rect x="240" y="135" width="60" height="80" rx="26" fill="#444" opacity=".7" />
      <circle cx="200" cy="112" r="32" fill="#fff" opacity=".9" /><polygon points="190,96 190,128 216,112" fill="#111" />
      <rect x="10" y="12" width="96" height="26" fill="#dc2626" /><text x="58" y="31" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff">CHOC 😱</text>
      <text x="390" y="215" textAnchor="end" fontSize="12" fill="#ddd">03:12</text>
    </Frame>
  ),
  pont: () => (
    <Frame bg="#cfe7f5">
      <rect x="0" y="150" width="400" height="75" fill="#4f86a6" />
      <path d="M0 120 H400 V135 H0Z" fill="#a8a29e" />{[40, 140, 240, 340].map((x) => <path key={x} d={`M${x} 135 q50 30 100 0`} fill="none" stroke="#78716c" strokeWidth="10" />)}
      {[120, 170, 220, 270].map((x) => <g key={x}><polygon points={`${x},118 ${x + 9},96 ${x + 18},118`} fill="#f97316" /><rect x={x + 3} y="104" width="12" height="4" fill="#fff" /></g>)}
      <rect x="150" y="76" width="100" height="22" rx="3" fill="#fde047" stroke="#111" /><text x="200" y="92" textAnchor="middle" fontSize="13" fontWeight="800">TRAVAUX</text>
    </Frame>
  ),
  complement: () => (
    <Frame bg="#ecfdf5">
      <rect x="150" y="60" width="100" height="140" rx="14" fill="#fff" stroke="#10b981" strokeWidth="4" /><rect x="160" y="40" width="80" height="26" rx="6" fill="#10b981" />
      <rect x="160" y="100" width="80" height="54" rx="6" fill="#d1fae5" /><text x="200" y="124" textAnchor="middle" fontSize="13" fontWeight="800" fill="#065f46">SUPER</text><text x="200" y="142" textAnchor="middle" fontSize="13" fontWeight="800" fill="#065f46">IMMUNITÉ</text>
      <path d="M80 160 q20 -60 70 -40 q-30 10 -70 40z" fill="#34d399" /><path d="M320 150 q-20 -60 -70 -40 q30 10 70 40z" fill="#34d399" />
      <circle cx="320" cy="60" r="30" fill="#ef4444" /><text x="320" y="66" textAnchor="middle" fontSize="18" fontWeight="900" fill="#fff">-50%</text>
    </Frame>
  ),
  maintenance: () => (
    <Frame bg="#111827">
      <rect x="0" y="0" width="400" height="225" fill="#0e1116" />
      <circle cx="170" cy="112" r="42" fill="none" stroke="#ff6b00" strokeWidth="16" strokeDasharray="20 12" /><circle cx="170" cy="112" r="14" fill="#ff6b00" />
      <circle cx="245" cy="88" r="24" fill="none" stroke="#fb923c" strokeWidth="10" strokeDasharray="12 8" />
      <text x="200" y="200" textAnchor="middle" fontSize="15" fill="#e5e7eb">Maintenance samedi 8 h à 10 h</text>
    </Frame>
  ),
};


/** Faux site affiché dans le navigateur du téléphone quand on touche un lien. */
export function SitePage({ site, url }: { site: Site; url: string }) {
  const Art = site.art ? ART[site.art] : null;
  const shady = site.kind === "phishing" || site.kind === "choc" || site.kind === "boutique";
  return (
    <div className="bg-white text-[#111] min-h-full text-[14px]">
      <header className="px-4 py-3 flex items-center gap-2 text-white" style={{ background: site.color }}>
        {site.kind === "phishing" && <span className="flex h-5 w-7 overflow-hidden rounded-sm" aria-hidden><span className="flex-1 bg-[#1e3a8a]" /><span className="flex-1 bg-white" /><span className="flex-1 bg-[#dc2626]" /></span>}
        <b className="text-[15px]">{site.brand}</b>
        <span className="ml-auto text-[18px]" aria-hidden>☰</span>
      </header>
      {site.kind === "choc" && <div className="bg-[#fde047] text-[12px] text-center py-1 font-semibold">🎁 Vous êtes le 1 000 000e visiteur ! Touchez ici pour réclamer votre iPhone</div>}
      {Art && <Art />}
      <main className="px-4 py-4 space-y-3">
        {site.date && <div className="text-[12px] text-[#666]">{site.date}</div>}
        <h1 className="text-[20px] font-bold leading-tight">{site.title}</h1>
        {site.price && <div className="flex items-baseline gap-2"><s className="text-[#999]">{site.price[0]}</s><b className="text-[22px] text-[#dc2626]">{site.price[1]}</b><span className="text-[#f59e0b]">★★★★★</span><span className="text-[12px] text-[#666]">(12 847 avis)</span></div>}
        {site.text.map((t, i) => <p key={i} className="leading-relaxed text-[#333]">{t}</p>)}
        {site.form && (
          <form className="space-y-2 pt-1" onSubmit={(e) => e.preventDefault()}>
            {site.form.map((f) => <label key={f} className="block text-[13px] text-[#444]">{f}<input disabled className="mt-0.5 w-full rounded border border-[#bbb] bg-[#f8f8f8] px-2 py-1.5" placeholder="(désactivé pendant l'épreuve)" /></label>)}
          </form>
        )}
        {site.cta && <button type="button" disabled className="w-full rounded-lg py-3 font-bold text-white" style={{ background: shady ? "#dc2626" : site.color }}>{site.cta}</button>}
        {site.kind === "choc" && (
          <div className="grid grid-cols-2 gap-2 pt-2">{["Perdez 10 kg sans effort", "Ce secret que les banques cachent", "Les célébrités le détestent", "Gagnez 3 000 €/semaine"].map((t) => <div key={t} className="rounded bg-[#f3f4f6] p-2 text-[11px]"><div className="h-12 bg-[#d1d5db] rounded mb-1" />{t}</div>)}</div>
        )}
      </main>
      <footer className="px-4 py-3 text-[11px] text-[#888] border-t border-[#eee]">{shady ? `© ${site.brand} · Mentions légales · Contact` : `© 2026 ${site.brand} · Mentions légales · Accessibilité · Données personnelles`}<div className="font-mono break-all mt-1">{url}</div></footer>
    </div>
  );
}
