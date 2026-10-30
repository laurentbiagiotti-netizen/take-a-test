import { forwardRef } from "react";

/**
 * Énoncé d'une question. Quand l'énoncé contient plusieurs lignes (code,
 * journal, grille, table de routage), la partie du milieu est affichée en
 * bloc à chasse fixe : l'indentation et l'alignement restent lisibles.
 *   1re ligne        : la consigne
 *   lignes suivantes : le bloc
 *   dernière ligne   : remise en texte si c'est une question (« ? » ou « : »)
 */
export function splitPrompt(prompt: string): { intro: string; block: string | null; outro: string | null } {
  const lines = prompt.replace(/\r/g, "").split("\n");
  if (lines.length < 2) return { intro: prompt, block: null, outro: null };
  const [intro, ...rest] = lines;
  let outro: string | null = null;
  const last = rest[rest.length - 1].trim();
  if (rest.length > 1 && /[?:]$/.test(last) && /^[A-ZÀ-Ý]/.test(last) && !/[{}();=]/.test(last)) outro = rest.pop()!.trim();
  return { intro, block: rest.join("\n"), outro };
}

const QuestionPrompt = forwardRef<HTMLHeadingElement, { prompt: string; className?: string }>(function QuestionPrompt({ prompt, className }, ref) {
  const { intro, block, outro } = splitPrompt(prompt);
  return (
    <div>
      <h2 ref={ref} tabIndex={-1} className={`outline-none ${className ?? "text-lg font-semibold"}`}>{intro}</h2>
      {block !== null && (
        <pre className="mt-3 p-3 rounded-md bg-[#05070d] border border-line font-mono text-sm overflow-x-auto whitespace-pre select-none">{block}</pre>
      )}
      {outro && <p className="mt-3 font-medium">{outro}</p>}
    </div>
  );
});

export default QuestionPrompt;
