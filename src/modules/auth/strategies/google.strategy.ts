import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { GoogleProfile } from '../interfaces';

/* LUONG XU LY GOOGLE-STRATEGY:
  // luc goi /auth/google, chua co code
  !req.code ? 
    redirect Google login page
    !done google login ?
      GG nem loi
    GG redirect req ve callbackURL kem theo code
  
  // luc goi /auth/google/callback, da co code
  gui code len GG doi lay token & profile 
  gui thong tin vua doi den validate() de xu ly tiep
  done -> return user?
*/

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
      scope: ['email', 'profile'], // Chi yeu cau truy cap email va profile
    });
  }

  async validate(
    accessToken: string, // -> Token tu GG (bo qua vi ta dung token rieng)
    refreshToken: string, // nhu tren
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      // Vi server dung email lam unique, catch truoc -> tranh lot vao service
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(
          new UnauthorizedException(
            'Tài khoản Google không có email. Vui lòng dùng tài khoản khác.',
          ),
          false,
        );
      }

      // Chi lay nhung thong tin can thiet
      const googleProfile: GoogleProfile = {
        googleId: profile.id,
        email,
        firstName: profile.name?.givenName ?? '',
        lastName: profile.name?.familyName ?? '',
        avatar: profile.photos?.[0]?.value,
      };

      // Goi service tim / tao user (ko tao token - callback route se tao sau)
      const user = await this.authService.findOrCreateGoogleUser(googleProfile);

      // Tra user ve cho Guard
      done(null, user);
      
    } catch (error) {
      // throw loi ve cho Guard
      done(error as Error, false);
    }
  }
}
