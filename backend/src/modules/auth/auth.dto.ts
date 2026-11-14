import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class LoginDto {
  @IsString() @MinLength(3) @MaxLength(255) username!: string;
  @IsString() @MinLength(10) @MaxLength(128) password!: string;
  @IsOptional() @IsString() @MaxLength(160) deviceId?: string;
  @IsOptional() @IsString() @MaxLength(160) deviceName?: string;
}
export class RefreshDto {
  @IsString() @MinLength(32) @MaxLength(512) refreshToken!: string;
}
export class ChangePasswordDto {
  @IsString() @MinLength(10) @MaxLength(128) currentPassword!: string;
  @IsString()
  @MinLength(14)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message: "كلمة المرور الجديدة يجب أن تحتوي على أحرف كبيرة وصغيرة ورقم ورمز",
  })
  newPassword!: string;
}
