"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FORMATIONS } from "@/lib/excel/bank";

/** Classes proposées partout : celles de la charte, puis celles créées par l'équipe. */
export function useClasses(): string[] {
  const [extra, setExtra] = useState<string[]>([]);
  useEffect(() => {
    createClient().from("classes").select("name").order("name").then(({ data }) => setExtra((data || []).map((c: any) => c.name)));
  }, []);
  return Array.from(new Set([...FORMATIONS, ...extra]));
}
