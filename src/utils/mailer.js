const nodemailer = require("nodemailer");

const sendOTPEmail = async (userEmail, otpCode) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "thienkhoatgddqng@gmail.com",
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: '"Hệ thống Xác thực" <chatboxl@gmail.com>',
    to: userEmail,
    subject: `Mã xác thực OTP của bạn: ${otpCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Xác thực tài khoản</h2>
        <p>Chào bạn,</p>
        <p>Mã xác thực (OTP) của bạn là:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #007bff; border-radius: 8px;">
          ${otpCode}
        </div>
        <p style="margin-top: 20px;">Mã này sẽ hết hạn sau <b>5 phút</b>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
        <hr style="border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #888;">Đây là email tự động, vui lòng không phản hồi.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("OTP Sent: " + info.response);
    return { success: true };
  } catch (error) {
    console.error("Lỗi gửi OTP: ", error);
    return { success: false, error };
  }
};

module.exports = { sendOTPEmail };