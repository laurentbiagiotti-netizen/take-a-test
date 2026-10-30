import DemoExam from "@/components/DemoExam";
import { DEMO_CHALLENGES } from "@/lib/terminal/demo";
import { DEMO_SCENARIO } from "@/lib/terminal/demo";
import { promptFor } from "@/lib/terminal/shell";

export const metadata = { title: "Démo · Cybersup Exam" };

export default function DemoPage() {
  const home = DEMO_SCENARIO.home!;
  return <DemoExam challenges={DEMO_CHALLENGES} terminal={{ cwd: home, prompt: promptFor(DEMO_SCENARIO, home), motd: DEMO_SCENARIO.motd || null }} />;
}
