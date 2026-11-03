import DemoExam from "@/components/DemoExam";
import { publicDemoQuestions } from "@/lib/demo/questions";
import { DEMO_SCENARIO } from "@/lib/terminal/demo";
import { evaluateObjectives, initState, promptFor } from "@/lib/terminal/shell";
import { toolConfig } from "@/lib/external/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Démo · Cybersup Exam" };

export default function DemoPage() {
  const st = initState(DEMO_SCENARIO);
  return (
    <DemoExam
      questions={publicDemoQuestions({ tools: !!toolConfig("crime") && !!toolConfig("win95") })}
      terminal={{ prompt: promptFor(DEMO_SCENARIO, st.cwd), motd: DEMO_SCENARIO.motd || null, objectives: evaluateObjectives(DEMO_SCENARIO, st) }}
    />
  );
}
