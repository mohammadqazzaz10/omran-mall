import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const timePattern = /^([01]\\d|2[0-3]):[0-5]\\d$/;

export class CreateShiftDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{2,50}$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nameAr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @IsString()
  @Matches(timePattern)
  startTime!: string;

  @IsString()
  @Matches(timePattern)
  endTime!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(morning|evening|night|flexible|part_time|temporary|seasonal)$/)
  shiftType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  requiredStaffCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  gracePeriodLateMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  gracePeriodEarlyLeaveMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateAssignmentDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsDateString()
  workDate!: string;

  @IsOptional()
  @IsBoolean()
  isDayOff?: boolean;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ScheduleRangeQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

export class CreateSwapRequestDto {
  @IsUUID()
  requesterAssignmentId!: string;

  @IsUUID()
  targetAssignmentId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class RespondSwapDto {
  @IsBoolean()
  accept!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class DecideSwapDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateCoverageRequirementDto {
  @IsUUID()
  departmentId!: string;

  @IsUUID()
  shiftId!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  @Min(1)
  @Max(500)
  minimumStaff!: number;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}
