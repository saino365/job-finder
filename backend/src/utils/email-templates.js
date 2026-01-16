function verifyEmailTemplate({ brandName = 'JobFinder', code, verifyLink }) {
  const styles = 'font-family: Arial, Helvetica, sans-serif; color:#111;';
  const btn = `display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;`;
  return `
<!doctype html>
<html>
  <body style="${styles}">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 8px 0;">Verify your email</h2>
      <p>Hi, thanks for signing up for ${brandName}. Use the code below to verify your email. It expires in 24 hours.</p>
      <div style="font-size:28px;letter-spacing:4px;font-weight:bold;margin:16px 0;">${code}</div>
      <p>Or click the button below:</p>
      <p>
        <a href="${verifyLink}" style="${btn}">Verify email</a>
      </p>
      <p style="color:#666;font-size:12px;margin-top:24px;">If you did not request this, you can ignore this email.</p>
    </div>
  </body>
</html>`;
}

function companyVerifyEmailTemplate({ brandName = 'JobFinder', code, verifyLink }) {
  const styles = 'font-family: Arial, Helvetica, sans-serif; color:#111;';
  const btn = `display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;`;
  return `
<!doctype html>
<html>
  <body style="${styles}">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 16px 0;">Welcome to ${brandName} - Verify Your Company Account</h2>
      <p>Thank you for registering your company with ${brandName}! To complete your registration and access the company setup page, please verify your email address.</p>

      ${code ? `
      <p style="margin:24px 0;">Use the 6-digit code below to verify your email. It expires in 24 hours:</p>
      <div style="font-size:28px;letter-spacing:4px;font-weight:bold;margin:16px 0;text-align:center;background:#f5f5f5;padding:16px;border-radius:8px;">${code}</div>
      <p style="margin:24px 0;">Or click the button below:</p>
      ` : `
      <p style="margin:24px 0;">Click the button below to verify your email and proceed to company setup:</p>
      `}

      <p style="text-align:center;margin:32px 0;">
        <a href="${verifyLink}" style="${btn}">Verify Email & Setup Company</a>
      </p>

      <p><strong>Next steps after verification:</strong></p>
      <ul style="margin:16px 0;padding-left:20px;">
        <li>Complete your company information</li>
        <li>Upload your SSM Superform document</li>
        <li>Submit for admin approval</li>
        <li>Start posting internship opportunities</li>
      </ul>

      <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
      <p style="color:#666;font-size:12px;">This verification code and link expire in 24 hours for security. If you did not create this account, you can safely ignore this email.</p>
    </div>
  </body>
</html>`;
}

export { verifyEmailTemplate, companyVerifyEmailTemplate };

