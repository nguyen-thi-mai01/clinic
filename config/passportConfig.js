// server/config/passportConfig.js
// ✅ PASSPORT OAUTH CONFIGURATION - GOOGLE + FACEBOOK ONLY

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const { models } = require('./db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// ============================================
// HELPER: Lấy BASE_URL và CLIENT_URL
// ============================================
const getBaseUrl = () => process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
const getClientUrl = () => process.env.CLIENT_URL || 'http://localhost:3000';

// ============================================
// GOOGLE OAUTH STRATEGY
// ============================================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || `${getBaseUrl()}/api/users/auth/google/callback`,
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('🔵 [Google OAuth] Profile ID:', profile.id);
        console.log('🔵 [Google OAuth] Email:', profile.emails?.[0]?.value);

        const email = profile.emails?.[0]?.value;
        if (!email) {
          console.error('❌ [Google OAuth] Email không được cung cấp');
          return done(new Error('Email không được cung cấp bởi Google'), null);
        }

        const googleId = profile.id;

        // 🔍 Tìm user theo email
        let user = await models.User.findOne({ 
          where: { email },
          include: [
            { model: models.Patient, required: false },
            { model: models.Doctor, required: false }
          ]
        });

        if (user) {
          // ✅ User đã tồn tại - cập nhật google_id nếu chưa có
          console.log('✅ [Google OAuth] User đã tồn tại:', email);
          
          if (!user.google_id) {
            user.google_id = googleId;
            user.oauth_provider = 'google';
            user.is_verified = true;  // OAuth đã verify
            user.is_active = true;
            user.last_login = new Date();
            await user.save();
            console.log('✅ [Google OAuth] Đã cập nhật google_id cho user');
          } else {
            // Chỉ update last_login
            user.last_login = new Date();
            await user.save();
          }

          return done(null, user);
        }

        // ✅ User chưa tồn tại - Tạo mới
        console.log('📝 [Google OAuth] Tạo user mới:', email);

        // Tạo random password (user không cần biết)
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = await models.User.create({
          email,
          username: email.split('@')[0],
          password_hash: hashedPassword,
          full_name: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
          avatar_url: profile.photos?.[0]?.value,
          role: 'patient',  // Mặc định là patient
          google_id: googleId,
          oauth_provider: 'google',
          is_verified: true,  // ⭐ OAuth đã verify email
          is_active: true,    // ⭐ Kích hoạt luôn
          last_login: new Date()
        });

        console.log('✅ [Google OAuth] Tạo user mới thành công:', email);
        return done(null, user);

      } catch (error) {
        console.error('❌ [Google OAuth] Lỗi:', error);
        return done(error, null);
      }
    }
  ));
  console.log('✅ Google OAuth Strategy initialized');
} else {
  console.log('⚠️  Google OAuth KHÔNG được cấu hình (thiếu CLIENT_ID hoặc CLIENT_SECRET)');
}

// ============================================
// FACEBOOK OAUTH STRATEGY
// ============================================
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL || `${getBaseUrl()}/api/users/auth/facebook/callback`,
      profileFields: ['id', 'emails', 'name', 'picture.type(large)']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('🔵 [Facebook OAuth] Profile ID:', profile.id);
        console.log('🔵 [Facebook OAuth] Emails:', profile.emails);

        const email = profile.emails?.[0]?.value;
        if (!email) {
          console.error('❌ [Facebook OAuth] Email không được cung cấp');
          return done(new Error('Email không được cung cấp bởi Facebook'), null);
        }

        const facebookId = profile.id;

        // 🔍 Tìm user theo email
        let user = await models.User.findOne({ 
          where: { email },
          include: [
            { model: models.Patient, required: false },
            { model: models.Doctor, required: false }
          ]
        });

        if (user) {
          // ✅ User đã tồn tại
          console.log('✅ [Facebook OAuth] User đã tồn tại:', email);
          
          if (!user.facebook_id) {
            user.facebook_id = facebookId;
            user.oauth_provider = 'facebook';
            user.is_verified = true;
            user.is_active = true;
            user.last_login = new Date();
            await user.save();
            console.log('✅ [Facebook OAuth] Đã cập nhật facebook_id cho user');
          } else {
            user.last_login = new Date();
            await user.save();
          }

          return done(null, user);
        }

        // ✅ User chưa tồn tại - Tạo mới
        console.log('📝 [Facebook OAuth] Tạo user mới:', email);

        const randomPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = await models.User.create({
          email,
          username: email.split('@')[0],
          password_hash: hashedPassword,
          full_name: `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() || profile.displayName,
          avatar_url: profile.photos?.[0]?.value,
          role: 'patient',
          facebook_id: facebookId,
          oauth_provider: 'facebook',
          is_verified: true,  // ⭐ OAuth đã verify
          is_active: true,    // ⭐ Kích hoạt luôn
          last_login: new Date()
        });

        console.log('✅ [Facebook OAuth] Tạo user mới thành công:', email);
        return done(null, user);

      } catch (error) {
        console.error('❌ [Facebook OAuth] Lỗi:', error);
        return done(error, null);
      }
    }
  ));
  console.log('✅ Facebook OAuth Strategy initialized');
} else {
  console.log('⚠️  Facebook OAuth KHÔNG được cấu hình (thiếu APP_ID hoặc APP_SECRET)');
}

// ============================================
// SERIALIZE/DESERIALIZE USER
// ============================================
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await models.User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

console.log('✅ Passport configuration completed');

module.exports = passport;