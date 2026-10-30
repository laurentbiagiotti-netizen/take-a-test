export const API_SCOPES = [
  "tests:read", "tests:write", "invites:read", "invites:write", "results:read", "proctor:write",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];
