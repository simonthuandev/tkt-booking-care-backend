import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { GoogleProfile } from '../interfaces/auth.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
      // ✅ Lỗi 1: Bỏ session: false — không có trong StrategyOptions của google-oauth20
      // Session OAuth tắt bằng cách không dùng session middleware, không phải flag này
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      // ✅ Lỗi 2: email có thể undefined nếu Google không trả về
      // Throw sớm thay vì để lọt xuống service với giá trị undefined
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(
          new UnauthorizedException(
            'Tài khoản Google không có email. Vui lòng dùng tài khoản khác.',
          ),
          false, // ✅ Lỗi 3: dùng false thay vì null
        );
      }

      const googleProfile: GoogleProfile = {
        googleId: profile.id,
        email, // đã được narrowed thành string
        firstName: profile.name?.givenName ?? '',
        lastName: profile.name?.familyName ?? '',
        avatar: profile.photos?.[0]?.value,
      };

      // Không lưu Google accessToken/refreshToken — chúng ta dùng JWT riêng
      const user = await this.authService.findOrCreateGoogleUser(googleProfile);
      done(null, user);
    } catch (error) {
      done(error as Error, false); // ✅ Lỗi 3: false thay vì null
    }
  }
}
