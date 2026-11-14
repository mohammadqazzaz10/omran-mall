import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateBranchDto {
  @IsString() @MinLength(2) @MaxLength(50) code!: string;
  @IsString() @MinLength(2) @MaxLength(255) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(255) nameEn?: string;
  @IsOptional() @IsString() @MaxLength(1000) address?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(100) email?: string;
}
export class UpdateBranchDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) nameAr?: string;
  @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) address?: string | null;
  @IsOptional() @IsString() @MaxLength(50) phone?: string | null;
  @IsOptional() @IsEmail() @MaxLength(100) email?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._-]+$/)
  username!: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MinLength(7) @MaxLength(50) phone?: string;
  @IsOptional() @IsUUID() primaryBranchId?: string;
  @IsOptional() @IsArray() @IsUUID("4", { each: true }) branchIds?: string[];
  @IsIn([
    "SUPER_ADMIN",
    "GENERAL_MANAGER",
    "BRANCH_MANAGER",
    "HR_MANAGER",
    "SUPERVISOR",
    "CASHIER",
    "EMPLOYEE",
  ])
  roleCode!: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
}
export class AssignUserRoleDto {
  @IsIn([
    "SUPER_ADMIN",
    "GENERAL_MANAGER",
    "BRANCH_MANAGER",
    "HR_MANAGER",
    "SUPERVISOR",
    "CASHIER",
    "EMPLOYEE",
  ])
  roleCode!: string;
  @IsOptional() @IsArray() @IsUUID("4", { each: true }) branchIds?: string[];
  @IsOptional() @IsUUID() departmentId?: string;
}
export class UpdateUserStatusDto {
  @IsBoolean() isActive!: boolean;
}
export class ListUsersQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsIn(["true", "false"]) active?: string;
  @IsOptional() @IsString() @MaxLength(10) page?: string;
  @IsOptional() @IsString() @MaxLength(10) limit?: string;
}
