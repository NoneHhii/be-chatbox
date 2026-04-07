const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: "thienkhoatgddqng@gmail.com",
        pass: process.env.AppPassword
    }
});

exports.sendOTP = async(email, otp) => {
    const mailOptions = {
        from: 'ChatBox Team <no-reply@gmail.com>',
        to: email,
        subject: 'Mã xác thực tài khoản',
        text: `Mã OTP của bạn là ${otp}. Có hiệu lực trong 5 phút`
    };
    return transporter.sendMail(mailOptions);
}