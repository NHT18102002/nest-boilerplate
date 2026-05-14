import { Role, UserStatus } from '@/commons/enums/app.enum';
import {
  BadRequest,
  InternalError,
  Unauthorized,
} from '@/commons/exceptions/business.exceptions';
import { ErrorCode } from '@/commons/exceptions/error-codes';
import { DefaultMessageResponseDto } from '@/commons/dtos/default-message-response.dto';
import { MailService } from '@/services/mail/mail.service';
import { RedisService } from '@/services/redis/redis.service';
import {
  getPasswordResetKey,
  getPasswordResetPattern,
  getRefreshSessionKey,
  getRefreshSessionPattern,
} from '@/utils/key-redis';
import { generateId } from '@/utils/nanoid-generators';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type * as jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { LoginDto } from './dtos/login.dto';
import { LogoutDto } from './dtos/logout.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { AuthTokenResponseDto } from './dtos/auth-response.dto';
import { User } from './entities/user.entity';
import {
  UserRegisterDto,
  UserResendOtpDto,
  UserVerifyOtpDto,
} from '../users/dtos/create-user.dto';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  sessionId: string;
  type: 'access';
}

interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  type: 'refresh';
}

interface PasswordResetTokenPayload {
  sub: string;
  nonce: string;
  type: 'password-reset';
}

interface RefreshSessionData {
  userId: string;
  refreshTokenHash: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {}

  async register(dto: UserRegisterDto): Promise<DefaultMessageResponseDto> {
    return this.usersService.register(dto);
  }

  async verifyRegistration(
    dto: UserVerifyOtpDto,
  ): Promise<DefaultMessageResponseDto> {
    return this.usersService.verifyRegistration(dto);
  }

  async resendRegistrationOtp(
    dto: UserResendOtpDto,
  ): Promise<DefaultMessageResponseDto> {
    return this.usersService.resendRegistrationOtp(dto);
  }

  async login(dto: LoginDto): Promise<AuthTokenResponseDto> {
    const user = await this.validateUserCredentials(dto.email, dto.password);
    return this.issueAuthTokens(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokenResponseDto> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const key = getRefreshSessionKey(payload.sub, payload.sessionId);
    const sessionRaw = await this.redisService.get(key);

    if (!sessionRaw) {
      throw new Unauthorized(
        'Refresh token expired or revoked',
        ErrorCode.SESSION_EXPIRED,
      );
    }

    const session = JSON.parse(sessionRaw) as RefreshSessionData;
    const refreshTokenMatches = await bcrypt.compare(
      dto.refreshToken,
      session.refreshTokenHash,
    );

    if (!refreshTokenMatches || session.userId !== payload.sub) {
      await this.redisService.del(key);
      throw new Unauthorized(
        'Refresh token is invalid',
        ErrorCode.REFRESH_TOKEN_INVALID,
      );
    }

    const user = await this.getActiveUserById(payload.sub);
    const nextAuthSession = await this.issueAuthTokens(user);
    await this.redisService.del(key);

    return nextAuthSession;
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<DefaultMessageResponseDto> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'status', 'banned'],
    });

    if (user && user.status === UserStatus.ACTIVE && !user.banned) {
      await this.redisService.removeKeyWithPrefix(
        getPasswordResetPattern(user.id),
      );

      const resetToken = await this.createPasswordResetToken(user.id);
      const resetUrl = this.buildPasswordResetUrl(resetToken);
      const sent = await this.mailService.sendPasswordReset(
        user.email,
        resetUrl,
      );

      if (!sent) {
        throw new InternalError(
          'Failed to send password reset email. Please try again later.',
          ErrorCode.EXTERNAL_SERVICE_ERROR,
        );
      }
    }

    return {
      message:
        'If the email exists in the system, a password reset link has been sent.',
    };
  }

  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<DefaultMessageResponseDto> {
    const payload = await this.verifyPasswordResetToken(dto.token);
    const key = getPasswordResetKey(payload.sub, payload.nonce);
    const tokenExists = await this.redisService.get(key);

    if (!tokenExists) {
      throw new BadRequest(
        'Password reset token is invalid or expired.',
        ErrorCode.PASSWORD_RESET_TOKEN_EXPIRED,
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'passwordHash', 'status', 'banned'],
    });

    if (!user || user.status !== UserStatus.ACTIVE || user.banned) {
      await this.redisService.del(key);
      throw new Unauthorized('User account is not active');
    }

    if (user.passwordHash) {
      const samePassword = await bcrypt.compare(
        dto.newPassword,
        user.passwordHash,
      );

      if (samePassword) {
        throw new BadRequest(
          'New password must be different from the current password.',
          ErrorCode.INVALID_INPUT,
        );
      }
    }

    await this.userRepository.update(user.id, {
      passwordHash: await this.hashPassword(dto.newPassword),
      emailVerified: true,
    });

    await Promise.all([
      this.redisService.del(key),
      this.redisService.removeKeyWithPrefix(getRefreshSessionPattern(user.id)),
    ]);

    return {
      message: 'Password reset successful. Please login again.',
    };
  }

  async logout(dto: LogoutDto): Promise<DefaultMessageResponseDto> {
    try {
      const payload = await this.verifyRefreshToken(dto.refreshToken);
      await this.redisService.del(
        getRefreshSessionKey(payload.sub, payload.sessionId),
      );
    } catch {
      // Logout is intentionally idempotent.
    }

    return {
      message: 'Logged out successfully.',
    };
  }

  private async validateUserCredentials(
    rawEmail: string,
    password: string,
  ): Promise<User> {
    const email = this.normalizeEmail(rawEmail);
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
        'phone',
        'address',
        'image',
        'mediaId',
        'identityNumber',
        'dateOfBirth',
        'isVerifiedKyc',
        'language',
        'banExpires',
        'banReason',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user || !user.passwordHash) {
      throw new Unauthorized(
        'Invalid email or password',
        ErrorCode.INVALID_CREDENTIALS,
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new Unauthorized(
        'Invalid email or password',
        ErrorCode.INVALID_CREDENTIALS,
      );
    }

    if (user.status !== UserStatus.ACTIVE || user.banned) {
      throw new Unauthorized('User account is not active');
    }

    return user;
  }

  private async getActiveUserById(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['media'],
      select: [
        'id',
        'email',
        'name',
        'role',
        'status',
        'banned',
        'emailVerified',
        'phone',
        'address',
        'image',
        'mediaId',
        'identityNumber',
        'dateOfBirth',
        'isVerifiedKyc',
        'language',
        'banExpires',
        'banReason',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user || user.status !== UserStatus.ACTIVE || user.banned) {
      throw new Unauthorized('Invalid user session', ErrorCode.SESSION_EXPIRED);
    }

    return user;
  }

  private async issueAuthTokens(
    user: User,
    existingSessionId?: string,
  ): Promise<AuthTokenResponseDto> {
    const sessionId = existingSessionId ?? generateId(32);
    const accessToken = await this.signAccessToken(user, sessionId);
    const refreshToken = await this.signRefreshToken(user.id, sessionId);

    await this.persistRefreshSession(user.id, sessionId, refreshToken);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.getAccessTokenExpiresIn(),
      refreshExpiresIn: this.getRefreshTokenExpiresIn(),
      user: this.toSafeUser(user),
    };
  }

  private async signAccessToken(
    user: User,
    sessionId: string,
  ): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role ?? Role.USER,
      sessionId,
      type: 'access',
    };

    return this.jwtService.signAsync(payload);
  }

  private async signRefreshToken(
    userId: string,
    sessionId: string,
  ): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: userId,
      sessionId,
      type: 'refresh',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.getRefreshTokenSecret(),
      expiresIn:
        this.getRefreshTokenExpiresIn() as jwt.SignOptions['expiresIn'],
    });
  }

  private async createPasswordResetToken(userId: string): Promise<string> {
    const nonce = randomBytes(24).toString('hex');
    const payload: PasswordResetTokenPayload = {
      sub: userId,
      nonce,
      type: 'password-reset',
    };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.getPasswordResetSecret(),
      expiresIn:
        this.getPasswordResetExpiresIn() as jwt.SignOptions['expiresIn'],
    });

    await this.redisService.setWithTimeoutMs(
      getPasswordResetKey(userId, nonce),
      this.getTokenTtlMs(token),
      '1',
    );

    return token;
  }

  private async persistRefreshSession(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<void> {
    const key = getRefreshSessionKey(userId, sessionId);
    const session: RefreshSessionData = {
      userId,
      refreshTokenHash: await bcrypt.hash(refreshToken, 12),
    };

    await this.redisService.setWithTimeoutMs(
      key,
      this.getTokenTtlMs(refreshToken),
      JSON.stringify(session),
    );
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.getRefreshTokenSecret(),
        },
      );

      if (payload.type !== 'refresh' || !payload.sub || !payload.sessionId) {
        throw new Unauthorized(
          'Refresh token is invalid',
          ErrorCode.REFRESH_TOKEN_INVALID,
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof Unauthorized) {
        throw error;
      }

      throw new Unauthorized(
        'Refresh token is invalid or expired',
        ErrorCode.REFRESH_TOKEN_INVALID,
      );
    }
  }

  private async verifyPasswordResetToken(
    token: string,
  ): Promise<PasswordResetTokenPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<PasswordResetTokenPayload>(token, {
          secret: this.getPasswordResetSecret(),
        });

      if (payload.type !== 'password-reset' || !payload.sub || !payload.nonce) {
        throw new BadRequest(
          'Password reset token is invalid.',
          ErrorCode.PASSWORD_RESET_TOKEN_INVALID,
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof BadRequest) {
        throw error;
      }

      throw new BadRequest(
        'Password reset token is invalid or expired.',
        ErrorCode.PASSWORD_RESET_TOKEN_INVALID,
      );
    }
  }

  private buildPasswordResetUrl(token: string): string {
    const frontendUrl = this.configService
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
    const resetPath = this.configService.get<string>(
      'PASSWORD_RESET_PATH',
      '/reset-password',
    );
    const normalizedResetPath = resetPath.startsWith('/')
      ? resetPath
      : `/${resetPath}`;

    return `${frontendUrl}${normalizedResetPath}?token=${encodeURIComponent(token)}`;
  }

  private getTokenTtlMs(token: string): number {
    const decoded = this.jwtService.decode(token);

    if (
      !decoded ||
      typeof decoded === 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      throw new InternalError('Unable to determine token expiration.');
    }

    return Math.max(decoded.exp * 1000 - Date.now(), 1000);
  }

  private getAccessTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '7d');
  }

  private getRefreshTokenExpiresIn(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
  }

  private getPasswordResetExpiresIn(): string {
    return this.configService.get<string>(
      'PASSWORD_RESET_TOKEN_EXPIRES_IN',
      '15m',
    );
  }

  private getRefreshTokenSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'dev-only-change-this-secret'
    );
  }

  private getPasswordResetSecret(): string {
    return (
      this.configService.get<string>('JWT_RESET_PASSWORD_SECRET') ||
      this.getRefreshTokenSecret()
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  private toSafeUser(user: User): User {
    const { passwordHash, ...safeUser } = user as User & {
      passwordHash?: string;
    };
    void passwordHash;
    return safeUser as User;
  }
}
