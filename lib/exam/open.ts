import { adminClient } from "@/lib/supabase/admin";

/** Épreuve ouverte à ce compte : publiée, ou aperçu d'un admin (invitation « preview »). */
export async function testOpenFor(admin: ReturnType<typeof adminClient>, test: { id: string; is_published: boolean } | null, email?: string | null) {
  if (!test) return false;
  if (test.is_published) return true;
  if (!email) return false;
  const { data } = await admin.from("invites").select("id").eq("test_id", test.id).eq("email", email.toLowerCase()).eq("preview", true).maybeSingle();
  return !!data;
}
