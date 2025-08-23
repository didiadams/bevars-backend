import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  newPassword: string;
}
