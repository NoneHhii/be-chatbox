const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.sendOTP = async (email, otp) => {
    try {
        const response = await resend.emails.send({
            from: 'onboarding@resend.dev', // ⚠️ bắt buộc domain hợp lệ
            to: email,
            subject: 'Mã xác thực tài khoản',
            html: `<p>Mã OTP của bạn là <strong>${otp}</strong>. Có hiệu lực trong 5 phút.</p>`
        });

        return response;
    } catch (error) {
        console.log("Send mail error:", error);
        throw error;
    }
};