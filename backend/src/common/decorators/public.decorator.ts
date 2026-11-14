import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "omran:isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
