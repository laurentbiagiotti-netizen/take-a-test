/** Remplace node:crypto (createHash) dans la version navigateur de la démo. */
import { sha256 } from "js-sha256";
import sha1 from "js-sha1";
import md5 from "js-md5";

export function createHash(algo: string) {
  let data = "";
  const api = {
    update(x: string) { data += x; return api; },
    digest(_enc: "hex") {
      if (algo === "sha256") return sha256(data);
      if (algo === "sha1") return (sha1 as any)(data);
      return (md5 as any)(data);
    },
  };
  return api;
}
