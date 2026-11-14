import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class EmployeeProfileUpsertDto {
  @IsOptional() @IsString() @MaxLength(100) bankName?: string | null;
  @IsOptional() @IsString() @MaxLength(100) bankIban?: string | null;
  @IsOptional() @IsString() @MaxLength(100) socialSecurityNumber?:
    string | null;
  @IsOptional() @IsString() @MaxLength(100) taxIdentificationNumber?:
    string | null;
  @IsOptional() @IsString() @MaxLength(100) educationLevel?: string | null;
  @IsOptional() @IsString() @MaxLength(150) specialization?: string | null;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) graduationYear?: number | null;
  @IsOptional() @IsString() @MaxLength(100) addressCity?: string | null;
  @IsOptional() @IsString() @MaxLength(100) addressArea?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) addressStreet?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
}

export class EmployeeDocumentCreateDto {
  @IsString() @MinLength(2) @MaxLength(100) documentType!: string;
  @IsString() @MinLength(2) @MaxLength(255) title!: string;
  // Opaque object key from the future private storage integration, not a public URL.
  @IsString() @MinLength(1) @MaxLength(1024) storageKey!: string;
  @IsOptional() @IsInt() @Min(1) @Max(26214400) fileSizeBytes?: number;
  @IsOptional() @IsString() @MaxLength(100) mimeType?: string | null;
  @IsOptional() @IsDateString() issueDate?: string | null;
  @IsOptional() @IsDateString() expiryDate?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(365) alertBeforeDays?: number;
}

export class EmployeeContractCreateDto {
  @IsIn(["full_time", "part_time", "seasonal", "temporary", "hourly"])
  contractType!: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string | null;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) basicSalary!: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(24)
  workingHoursPerDay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(7) workingDaysPerWeek?: number;
  @IsOptional() @IsBoolean() hasSocialSecurity?: boolean;
  @IsOptional() @IsBoolean() hasHealthInsurance?: boolean;
  @IsOptional() @IsString() @MaxLength(1024) documentStorageKey?: string | null;
}
