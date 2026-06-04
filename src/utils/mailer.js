const { Resend } = require('resend');

// Khởi tạo Resend bằng API Key từ Environment Variable
const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTPEmail = async (userEmail, otpCode) => {
  console.log("Check RESEND_KEY:", process.env.RESEND_API_KEY ? "Đã nhận" : "Chưa nhận");
  
  try {
    const data = await resend.emails.send({
      from: 'ChatBox <noreply@be-chatbox-1.onrender.com>', // Giữ nguyên email mặc định này của Resend để test miễn phí
      to: userEmail,
      subject: `Mã xác thực OTP của bạn: ${otpCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #24786D; text-align: center;">Xác thực tài khoản</h2>
          <p>Mã xác thực (OTP) của bạn là:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #24786D; border-radius: 8px;">
            ${otpCode}
          </div>
          <p>Mã hết hạn sau 5 phút.</p>
        </div>
      `,
    });

    console.log("OTP Sent qua Resend thành công:", data);
    return { success: true };
  } catch (error) {
    console.error("Lỗi gửi OTP thực tế tại Resend: ", error);
    return { success: false, error };
  }
};

module.exports = { sendOTPEmail };