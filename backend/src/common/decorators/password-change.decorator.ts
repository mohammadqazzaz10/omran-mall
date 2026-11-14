import { SetMetadata } from "@nestjs/common";

export const PASSWORD_CHANGE_ALLOWED_KEY = "omran:passwordChangeAllowed";

/** Allows a session marked for password rotation to access only password change/logout routes. */
export const AllowPasswordChangeOnly = () =>
  SetMetadata(PASSWORD_CHANGE_ALLOWED_KEY, true);
