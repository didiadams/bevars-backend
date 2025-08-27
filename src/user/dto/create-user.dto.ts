import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
} from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 20, { message: 'password must be between 6 and 20 characters' })
  password: string;

  @IsNotEmpty()
  @IsIn([UserRole.GLOBAL_BUYER, UserRole.EXPORTER, UserRole.ADMIN], {
    message: 'Role must be either global_buyer, exporter, or admin'
  })
  role: UserRole;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  countryName: string;

  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsNotEmpty()
  phoneNumber: string;
}


