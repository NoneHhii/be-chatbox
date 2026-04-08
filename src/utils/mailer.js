const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: "thienkhoatgddqng@gmail.com",
        pass: process.env.AppPassword 
    },
    // THÊM ĐOẠN NÀY ĐỂ FIX LỖI ENETUNREACH
    connectionTimeout: 10000, // 10 giây
    greetingTimeout: 10000,
    socketTimeout: 10000,
    dnsLookup: (hostname, options, callback) => {
        require('dns').lookup(hostname, { family: 4 }, callback);
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