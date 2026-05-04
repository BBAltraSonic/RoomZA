export const roles = ["renter", "landlord"] as const;

export type Role = (typeof roles)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

export function getRoleHome(role: Role) {
  return role === "landlord" ? "/dashboard" : "/applications";
}
