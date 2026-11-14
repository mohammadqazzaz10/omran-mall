import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSION_KEY = "omran:requiredPermission";
export const SKIP_PERMISSION_KEY = "omran:skipPermission";

export const RequirePermission = (permissionCode: string) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permissionCode);

/** Only for authenticated infrastructure endpoints such as /auth/me and /auth/logout. */
export const SkipPermissionCheck = () => SetMetadata(SKIP_PERMISSION_KEY, true);
