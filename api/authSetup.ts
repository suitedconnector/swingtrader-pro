import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { storage } from './storage';
import { verifyPassword } from './auth';

export function setupAuth() {
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);

        if (!user) {
          return done(null, false, {
            message: 'Invalid username or password',
          });
        }

        // Only bcrypt password hashes are accepted.
        const isBcrypt = /^\$2[aby]\$\d{2}\$/.test(user.password);

        if (!isBcrypt) {
          return done(null, false, {
            message: 'Password reset required',
          });
        }

        const isValid = await verifyPassword(password, user.password);

        if (!isValid) {
          return done(null, false, {
            message: 'Invalid username or password',
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || false);
    } catch (err) {
      done(err);
    }
  });
}
