/**
 * Re-export auth actions from the canonical feature location.
 * Domain logic lives in src/features/auth/actions.ts (R2.1).
 */
export {
  signInAction,
  signUpAction,
  signOutAction,
  requestPasswordResetAction,
  updatePasswordAction,
} from "@/features/auth/actions";
