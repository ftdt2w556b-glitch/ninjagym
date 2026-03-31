import { createHmac } from "crypto";

const SECRET =
  process.env.MEMBER_TOKEN_SECRET ?? "ng-dev-secret-replace-in-prod";

/**
 * Returns a 24-char HMAC token that proves the caller knows this member's ID.
 * Include as ?token=... in card URLs so cards can't be enumerated by ID.
 */
export function signMemberId(id: number): string {
  return createHmac("sha256", SECRET)
    .update(String(id))
    .digest("hex")
    .slice(0, 24);
}

export function verifyMemberToken(id: number, token: string | undefined): boolean {
  if (!token) return false;
  return signMemberId(id) === token;
}
