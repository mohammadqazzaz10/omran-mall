import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class EmployeeSelfUpdateDto {
  @IsOptional() @IsString() @MinLength(7) @MaxLength(50) mobilePhone?: string;
  @IsOptional() @IsEmail() @MaxLength(255) personalEmail?: string | null;
  @IsOptional() @IsString() @MaxLength(150) emergencyContactName?: string | null;
  @IsOptional() @IsString() @MaxLength(50) emergencyContactPhone?: string | null;
  @IsOptional() @IsString() @MaxLength(50) emergencyContactRelation?: string | null;
}
