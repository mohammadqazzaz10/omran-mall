import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { PartialType } from "@nestjs/swagger";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BreakBlackoutPeriodDto {
  @IsString()
  @Matches(timePattern)
  start!: string;

  @IsString()
  @Matches(timePattern)
  end!: string;
}

export class CreateBreakTypeDto {
  @IsString()
  @Matches(/^[a-z0-9_]{2,50}$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nameAr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @IsInt()
  @Min(1)
  @Max(240)
  defaultDurationMinutes!: number;

  @IsInt()
  @Min(1)
  @Max(360)
  maxDurationMinutes!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  dailyQuotaTimes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  cooldownBetweenBreaksMinutes?: number;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  deductFromWorkHours?: boolean;

  @IsOptional()
  @IsString()
  @Matches(timePattern)
  allowedStartTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(timePattern)
  allowedEndTime?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxSimultaneousPerDepartment?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BreakBlackoutPeriodDto)
  blackoutPeriods?: BreakBlackoutPeriodDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  notifyBeforeEndMinutes?: number;

  @IsOptional()
  @IsBoolean()
  allowEarlyReturn?: boolean;
}

export class UpdateBreakTypeDto extends PartialType(CreateBreakTypeDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RequestBreakDto {
  @IsUUID()
  breakTypeId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(360)
  requestedDurationMinutes?: number;
}

export class RejectBreakRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reason!: string;
}

export class ListBreakRequestsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^(pending|approved|rejected|expired|cancelled)$/)
  status?: string;
}
