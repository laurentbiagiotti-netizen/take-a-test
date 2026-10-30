/**
 * Démo statique pour GitHub Pages : même interface que /demo, mais la
 * machine Linux simulée et la correction s'exécutent dans le navigateur.
 */
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/archivo-black/400.css";
import "@fontsource/jetbrains-mono/400.css";
import { createRoot } from "react-dom/client";
import DemoExam, { type DemoApi } from "@/components/DemoExam";
import { DEMO_QUESTIONS, publicDemoQuestions } from "@/lib/demo/questions";
import { DEMO_FLAG, DEMO_SCENARIO } from "@/lib/terminal/demo";
import { evaluateObjectives, initState, promptFor, runShell, type ShellState } from "@/lib/terminal/shell";
import { grade } from "@/lib/questions/kinds";

let state: ShellState = initState(DEMO_SCENARIO);
const objectives = () => evaluateObjectives(DEMO_SCENARIO, state);

const localApi: DemoApi = {
  run: async (command) => {
    const r = runShell(DEMO_SCENARIO, state, command);
    state = r.state;
    return { ok: true, data: { output: r.output, prompt: promptFor(DEMO_SCENARIO, state.cwd), clear: !!r.clear, objectives: objectives() } };
  },
  grade: async (answers, flag) => ({
    results: DEMO_QUESTIONS.map((q) => ({ id: q.id, score: grade(q.type, q.points, answers[q.id], q.key), points: q.points })),
    flag: flag.trim() === DEMO_FLAG,
  }),
};

createRoot(document.getElementById("root")!).render(
  <DemoExam
    questions={publicDemoQuestions()}
    terminal={{ prompt: promptFor(DEMO_SCENARIO, state.cwd), motd: DEMO_SCENARIO.motd || null, objectives: objectives() }}
    api={localApi}
    staticSite
    logoSrc="./cybersup-logo-blanc.svg"
    modelUrl="./models"
  />,
);
