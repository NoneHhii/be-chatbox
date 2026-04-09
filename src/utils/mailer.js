const nodemailer = require('nodemailer');
const dns = require('dns'); // Thêm thư viện dns có sẵn của Node.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Dùng SSL cho cổng 465
    auth: {
        user: "thienkhoatgddqng@gmail.com",
        pass: process.env.AppPassword 
    },
    // ĐOẠN QUAN TRỌNG NHẤT: Ép buộc dùng IPv4
    dnsLookup: (hostname, options, callback) => {
        dns.lookup(hostname, { family: 4 }, (err, address, family) => {
            callback(err, address, family);
        });
    }
});

exports.sendOTP = async (email, otp) => {
    const mailOptions = await resend.emails.send({
        from: '"ChatBox Team" <thienkhoatgddqng@gmail.com>', // Sửa lại From cho đồng nhất
        to: email,
        subject: 'Mã xác thực tài khoản',
        text: `Mã OTP của bạn là ${otp}. Có hiệu lực trong 5 phút.`
    });
    return transporter.sendMail(mailOptions);
};