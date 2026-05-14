import { Role, UserStatus } from '@/commons/enums/app.enum';
import {
  UnauthorizedException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { LoginDto } from './dtos/login.dto';
import { User } from './entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email },
      select: [
        'id',
        'email',
        'name',
        'role',
        'status',
        'banned',
        'passwordHash',
        'emailVerified',
      ],
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE || user.banned) {
      throw new UnauthorizedException('User account is not active');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role ?? Role.USER,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
      user: this.toSafeUser(user),
    };
  }

  private toSafeUser(user: User) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
