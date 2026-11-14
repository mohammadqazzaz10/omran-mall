import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

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
