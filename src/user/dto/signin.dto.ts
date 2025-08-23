import { IsEmail, IsEnum, IsString } from 'class-validator';
// import { UserRole } from '../entities/user.entity';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  //  @IsEnum(UserRole, { message: 'Role must either be farmer or buyer' })
  //   role: UserRole
}
