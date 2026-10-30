import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { appHost, appUrl, supabaseHost } from "@/lib/security/env";
import { requireStaff } from "@/lib/auth/staff";

/**
 * Génère le fichier .seb (plist XML non chiffré) d'un examen.
 *
 * Réservé aux administrateurs : un candidat qui obtient le .seb en clair
 * peut recalculer la Config Key et le hash du mot de passe de sortie.
 *
 * Procédure : télécharger, ouvrir dans l'outil de configuration SEB, relever
 * la Browser Exam Key (onglet Exam, une par version/OS de SEB autorisée),
 * la coller dans les réglages du test, puis RÉENREGISTRER le .seb chiffré
 * par mot de passe avant de le distribuer.
 *
 * Le fichier contient un sel propre à l'examen (examKeySalt) : la Browser
 * Exam Key est donc différente pour chaque examen et ne peut pas être
 * réutilisée d'une session à l'autre.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function xml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff(req, true);
  if ("res" in staff) return staff.res;
  if (!UUID.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const admin = adminClient();
  const { data: test } = await admin.from("tests").select("id, is_published").eq("id", id).maybeSingle();
  if (!test) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: sec } = await admin.from("test_secrets").select("seb_quit_password_hash, seb_exam_key_salt").eq("test_id", id).maybeSingle();
  let salt = sec?.seb_exam_key_salt;
  if (!salt) {
    const b = new Uint8Array(32); crypto.getRandomValues(b);
    salt = Buffer.from(b).toString("base64");
    await admin.from("test_secrets").upsert({ test_id: id, seb_exam_key_salt: salt }, { onConflict: "test_id" });
  }

  const origin = appUrl();
  const startUrl = `${origin}/test/${id}`;
  const quitHash = /^[a-f0-9]{64}$/i.test(sec?.seb_quit_password_hash || "") ? sec!.seb_quit_password_hash! : "";

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>startURL</key><string>${xml(startUrl)}</string>
  <key>sebConfigPurpose</key><integer>0</integer>
  <key>browserViewMode</key><integer>1</integer>
  <key>mainBrowserWindowWidth</key><string>100%</string>
  <key>mainBrowserWindowHeight</key><string>100%</string>
  <key>enableTouchExit</key><false/>
  <key>allowQuit</key><true/>
  <key>hashedQuitPassword</key><string>${quitHash}</string>
  <key>quitURL</key><string>${xml(origin)}/dashboard?seb_quit=1</string>
  <key>quitURLConfirm</key><true/>
  <key>examSessionClearCookiesOnStart</key><true/>
  <key>examSessionClearCookiesOnEnd</key><true/>
  <key>ignoreExitKeys</key><true/>
  <key>enableF1</key><false/><key>enableF3</key><false/><key>enableF5</key><false/>
  <key>enableF11</key><false/><key>enableF12</key><false/>
  <key>enablePrintScreen</key><false/>
  <key>enableEsc</key><false/><key>enableCtrlEsc</key><false/><key>enableAltEsc</key><false/>
  <key>enableAltTab</key><false/><key>enableAltF4</key><false/><key>enableStartMenu</key><false/>
  <key>enableRightMouse</key><false/>
  <key>enablePrivateClipboard</key><true/>
  <key>showTaskBar</key><false/><key>showReloadButton</key><false/><key>showMenuBar</key><false/>
  <key>browserScreenKeyboard</key><false/>
  <key>allowSpellCheck</key><false/><key>allowDictation</key><false/><key>allowSiri</key><false/>
  <key>enableJavaScript</key><true/>
  <key>enableBrowsingBackForward</key><false/>
  <key>newBrowserWindowByLinkPolicy</key><integer>0</integer>
  <key>newBrowserWindowByScriptPolicy</key><integer>0</integer>
  <key>blockPopUpWindows</key><true/>
  <key>allowDownUploads</key><false/><key>allowDownloads</key><false/>
  <key>allowPDFReaderToolbar</key><false/>
  <key>allowVideoCapture</key><true/><key>allowAudioCapture</key><false/>
  <key>allowScreenSharing</key><false/>
  <key>allowVirtualMachine</key><false/>
  <key>allowDisplayMirroring</key><false/>
  <key>allowedDisplaysMaxNumber</key><integer>1</integer>
  <key>allowedDisplayBuiltin</key><true/>
  <key>detectStoppedProcess</key><true/>
  <key>monitorProcesses</key><true/>
  <key>killExplorerShell</key><false/>
  <key>enableAppSwitcherCheck</key><true/>
  <key>forceAppFolderInstall</key><true/>
  <key>prohibitedProcesses</key>
  <array>
    <dict><key>active</key><true/><key>currentUser</key><true/><key>executable</key><string>TeamViewer</string><key>os</key><integer>1</integer><key>strongKill</key><true/></dict>
    <dict><key>active</key><true/><key>currentUser</key><true/><key>executable</key><string>AnyDesk</string><key>os</key><integer>1</integer><key>strongKill</key><true/></dict>
    <dict><key>active</key><true/><key>currentUser</key><true/><key>executable</key><string>obs64</string><key>os</key><integer>1</integer><key>strongKill</key><true/></dict>
    <dict><key>active</key><true/><key>currentUser</key><true/><key>executable</key><string>Discord</string><key>os</key><integer>1</integer><key>strongKill</key><true/></dict>
  </array>
  <key>URLFilterEnable</key><true/>
  <key>URLFilterEnableContentFilter</key><true/>
  <key>URLFilterRules</key>
  <array>
    <dict><key>action</key><integer>1</integer><key>active</key><true/><key>expression</key><string>${xml(appHost())}/*</string><key>regex</key><false/></dict>
    <dict><key>action</key><integer>1</integer><key>active</key><true/><key>expression</key><string>${xml(supabaseHost())}/storage/v1/object/public/question-images/*</string><key>regex</key><false/></dict>
  </array>
  <key>sendBrowserExamKey</key><true/>
  <key>examKeySalt</key><data>${salt}</data>
</dict>
</plist>`;

  return new NextResponse(plist, {
    headers: {
      "Content-Type": "application/seb",
      "Content-Disposition": `attachment; filename="examen-${id}.seb"`,
      "Cache-Control": "no-store",
    },
  });
}
