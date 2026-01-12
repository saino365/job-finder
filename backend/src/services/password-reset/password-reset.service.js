import crypto from 'crypto';
import Users from '../../models/users.model.js';
import { sendMail } from '../../utils/mailer.js';

function resetPasswordTemplate({ brandName = 'JobFinder', resetLink, minutes = 30 }) {
  const styles = 'font-family: Arial, Helvetica, sans-serif; color:#111;';
  const btn = `display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;`;
  return `
<!doctype html>
<html>
  <body style="${styles}">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 8px 0;">Reset your password</h2>
      <p>We received a request to reset your password. The link below expires in ${minutes} minutes.</p>
      <p>
        <a href="${resetLink}" style="${btn}">Set a new password</a>
      </p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
      <p style="color:#666;font-size:12px">This link will expire automatically for your security.</p>
    </div>
  </body>
</html>`;
}

class PasswordResetService {
  constructor(options, app) {
    this.options = options || {};
    this.app = app;
  }

  // Request password reset email
  async create(data = {}) {
    const { email } = data;
    if (!email) {
      const err = new Error('Email is required');
      err.code = 400; throw err;
    }

    const users = this.app.service('users');
    const list = await users.find({ paginate: false, query: { email: String(email).toLowerCase() } });
    const user = Array.isArray(list) ? list[0] : list;
    if (!user) {
      // Do not reveal whether user exists
      return { ok: true };
    }

    const token = crypto.randomBytes(24).toString('hex');
    const minutes = Number(process.env.PASSWORD_RESET_EXPIRES_MIN || 30);
    const expires = new Date(Date.now() + minutes * 60 * 1000);

    // Store token + expiry
    await Users.updateOne({ _id: user._id }, { $set: { passwordResetToken: token, passwordResetExpires: expires } });

    const baseWeb = process.env.PUBLIC_WEB_URL || '';
    const resetLink = `${baseWeb}/reset-password?token=${token}&email=${encodeURIComponent(String(email).toLowerCase())}&exp=${expires.getTime()}`;

    // Send email (best-effort)
    const subject = 'Reset your password';
    const text = `Click the link to set a new password (expires in ${minutes} minutes): ${resetLink}`;
    const html = resetPasswordTemplate({ resetLink, minutes });
    try { await sendMail({ to: String(email).toLowerCase(), subject, text, html }); } catch (_) {}

    return { ok: true };
  }

  // Reset password with token
  async patch(id, data = {}) {
    const { token, email, password } = data;
    if (!token || !password || !email) { const err = new Error('token, email and password are required'); err.code = 400; throw err; }

    const user = await Users.findOne({ email: String(email).toLowerCase(), passwordResetToken: token });
    if (!user) { const err = new Error('Invalid token'); err.code = 400; throw err; }
    if (user.passwordResetExpires && new Date(user.passwordResetExpires) < new Date()) {
      const err = new Error('Token expired'); err.code = 400; throw err;
    }

    const isSamePassword = await user.comparePassword(password);
    if (isSamePassword) {
      const err = new Error('New password cannot be the same as your current password');
      err.code = 400;
      throw err;
    }

    // Update password via service (to use hashPassword hook)
    await this.app.service('users').patch(user._id, { password }, { provider: null });

    // Clear token & expiry directly
    await Users.updateOne({ _id: user._id }, { $unset: { passwordResetToken: '', passwordResetExpires: '' } });

    return { ok: true };
  }
}

export default function (app) {
  const options = { paginate: app.get('paginate') };
  const svc = new PasswordResetService(options, app);
  app.use('/password-reset', svc);
  app.service('password-reset').hooks({
    before: { all: [] },
    after: { all: [] },
    error: { all: [] }
  });
}

