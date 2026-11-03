// Remplace node:zlib dans le navigateur (just-bash) : gzip n'est pas proposé aux candidats.
const off = () => { throw new Error("gzip n'est pas disponible dans cet exercice"); };
export const gunzipSync = off;
export const gzipSync = off;
export const constants = {};
export default { gunzipSync, gzipSync, constants };
