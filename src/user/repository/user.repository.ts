import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async createUser(user: Partial<User>): Promise<User> {
    try {
      return this.repository.create(user);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async saveUser(user: User): Promise<User> {
    try {
      return this.repository.save(user);
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<User | undefined> {
    console.log('Finding user by email:', email);
    try {
      return this.repository.findOne({
        where: { email },
        relations: ['farmer', 'buyer'],
      });
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  async findUserById(id: string): Promise<User | undefined> {
    try {
      return this.repository.findOne({
        where: { id },
        relations: ['farmer', 'buyer'],
      });
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async verifyEmail(id: string): Promise<void> {
    try {
      await this.repository.update(id, { isVerified: true });
    } catch (error) {
      console.error('Error verifying email:', error);
      throw error;
    }
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    try {
      await this.repository.update(
        { id: userId }, // Changed this line - now using proper where clause format
        { password: newPassword },
      );
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  }

  async findAndCount(options: any): Promise<[User[], number]> {
    try {
      return this.repository.findAndCount(options);
    } catch (error) {
      console.error('Error finding and counting users:', error);
      throw error;
    }
  }

  async findOne(options: any): Promise<User | undefined> {
    try {
      return this.repository.findOne(options);
    } catch (error) {
      console.error('Error finding one user:', error);
      throw error;
    }
  }
}
