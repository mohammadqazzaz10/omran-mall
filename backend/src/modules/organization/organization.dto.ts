import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class DepartmentDto {
  @IsString() @MinLength(2) @MaxLength(255) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(255) nameEn?: string;
  @IsString() @MinLength(1) @MaxLength(50) code!: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsUUID() managerEmployeeId?: string | null;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxSimultaneousBreakPercentage?: number;
}

export class PositionDto {
  @IsUUID() departmentId!: string;
  @IsString() @MinLength(1) @MaxLength(50) code!: string;
  @IsString() @MinLength(2) @MaxLength(255) titleAr!: string;
  @IsOptional() @IsString() @MaxLength(255) titleEn?: string;
  @IsOptional() @IsString() @MaxLength(50) jobLevel?: string;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  basicSalaryMin?: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  basicSalaryMax?: number;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
}

export class EmployeeDto {
  @IsUUID() departmentId!: string;
  @IsUUID() positionId!: string;
  @IsOptional() @IsUUID() directManagerId?: string | null;
  @IsString() @MinLength(1) @MaxLength(100) firstNameAr!: string;
  @IsString() @MinLength(1) @MaxLength(100) secondNameAr!: string;
  @IsOptional() @IsString() @MaxLength(100) thirdNameAr?: string;
  @IsString() @MinLength(1) @MaxLength(100) lastNameAr!: string;
  @IsOptional() @IsString() @MaxLength(255) fullNameEn?: string;
  @IsOptional() @IsString() @MaxLength(50) nationalId?: string;
  @IsOptional() @IsString() @MaxLength(50) passportNumber?: string;
  @IsOptional() @IsString() @MaxLength(100) nationality?: string;
  @IsOptional() @IsIn(["male", "female", "other"]) gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(255) personalEmail?: string;
  @IsString() @MinLength(5) @MaxLength(50) mobilePhone!: string;
  @IsOptional() @IsString() @MaxLength(150) emergencyContactName?: string;
  @IsOptional() @IsString() @MaxLength(50) emergencyContactPhone?: string;
  @IsOptional() @IsString() @MaxLength(50) emergencyContactRelation?: string;
  @IsOptional() @IsString() @MaxLength(50) maritalStatus?: string;
  @IsDateString() hireDate!: string;
  @IsOptional() @IsDateString() probationEndDate?: string;
  @IsOptional() @IsDateString() contractEndDate?: string;
}

export class EmployeeUpdateDto {
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() positionId?: string;
  @IsOptional() @IsUUID() directManagerId?: string | null;
  @IsOptional() @IsString() @MaxLength(100) firstNameAr?: string;
  @IsOptional() @IsString() @MaxLength(100) secondNameAr?: string;
  @IsOptional() @IsString() @MaxLength(100) thirdNameAr?: string;
  @IsOptional() @IsString() @MaxLength(100) lastNameAr?: string;
  @IsOptional() @IsString() @MaxLength(255) fullNameEn?: string;
  @IsOptional() @IsString() @MaxLength(50) nationalId?: string;
  @IsOptional() @IsString() @MaxLength(50) passportNumber?: string;
  @IsOptional() @IsString() @MaxLength(100) nationality?: string;
  @IsOptional() @IsIn(["male", "female", "other"]) gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() @MaxLength(255) personalEmail?: string;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(50) mobilePhone?: string;
  @IsOptional() @IsString() @MaxLength(150) emergencyContactName?: string;
  @IsOptional() @IsString() @MaxLength(50) emergencyContactPhone?: string;
  @IsOptional() @IsString() @MaxLength(50) emergencyContactRelation?: string;
  @IsOptional() @IsString() @MaxLength(50) maritalStatus?: string;
  @IsOptional() @IsDateString() hireDate?: string;
  @IsOptional() @IsDateString() probationEndDate?: string;
  @IsOptional() @IsDateString() contractEndDate?: string;
  @IsOptional() @IsIn(["active", "on_leave", "suspended"]) status?: string;
}

export class DepartmentUpdateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) nameAr?: string;
  @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) code?: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsUUID() managerEmployeeId?: string | null;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxSimultaneousBreakPercentage?: number;
}

export class PositionUpdateDto {
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) code?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) titleAr?: string;
  @IsOptional() @IsString() @MaxLength(255) titleEn?: string | null;
  @IsOptional() @IsString() @MaxLength(50) jobLevel?: string | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) basicSalaryMin?:
    number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) basicSalaryMax?:
    number | null;
  @IsOptional() @IsString() @MaxLength(5000) description?: string | null;
}

export class EmployeeTransferDto {
  @IsUUID() targetBranchId!: string;
  @IsUUID() targetDepartmentId!: string;
  @IsUUID() targetPositionId!: string;
  @IsOptional() @IsUUID() targetDirectManagerId?: string | null;
  @IsOptional() @IsDateString() effectiveDate?: string;
  @IsString() @MinLength(10) @MaxLength(2000) reason!: string;
}
