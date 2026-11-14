import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class AttendanceCorrectionDto {
  @IsDateString()
  workDate!: string;

  @IsOptional()
  @IsDateString()
  requestedCheckIn?: string;

  @IsOptional()
  @IsDateString()
  requestedCheckOut?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class AttendanceQrCheckInDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  qrToken!: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  accuracyMeters?: number;
}

export class AttendanceCorrectionRejectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;
}
