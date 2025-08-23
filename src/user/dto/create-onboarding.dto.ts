import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class FarmerOnboardingDto {
  @IsNumber()
  @Min(18, { message: 'Age must be atlease 18 years' })
  @Max(80, { message: 'Age must not exceed 80 years' })
  age: number;

  @IsString()
  @IsNotEmpty()
  educationalLevel: string;

  @IsEnum(['Male', 'Female'], { message: 'Gender must be male or female' })
  @IsNotEmpty()
  gender: 'Male' | 'Female';
}
