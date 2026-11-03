import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Ouvre une session Supabase pour un utilisateur existant, côté serveur, sans
 * e-mail ni mot de passe : lien magique généré par l'API d'administration puis
 * vérifié aussitôt. Les cookies de session sont posés sur la réponse.
 */
export async function openSession(req: NextRequest, res: NextResponse, email: string): Promise<boolean> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return false;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options?: any }[]) =>
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
  const { error: e2 } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: hash });
  return !e2;
}

/** Crée le compte s'il n'existe pas (adresse confirmée d'office). Renvoie son id. */
export async function ensureUser(email: string, fullName?: string | null, password?: string): Promise<string | null> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, email_confirm: true, ...(password ? { password } : {}),
    user_metadata: fullName ? { full_name: fullName } : {},
  });
  if (data?.user) return data.user.id;
  if (error && !/already|exists|registered/i.test(error.message)) return null;
  const { data: p } = await admin.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  return p?.id ?? null;
}
