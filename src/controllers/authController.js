const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {v4: uuidv4} = require('uuid');
const userModel = require("../models/userModel");
const pool = require("../config/db");
const uploadFile = require('../services/file.service');

const mailer = require('../utils/mailer');

// API 1: Gửi OTP
exports.sendRegistrationOTP = async (req, res) => {
    try {
        const { email, username } = req.body;
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Tạo mã 6 số

        // Lưu vào bảng otp_verification (Xóa cái cũ nếu có)
        await pool.query(`
            INSERT INTO otp_verification (email, otp, user_data, expires_at)
            VALUES ($1, $2, $3, NOW() + INTERVAL '5 minutes')
            ON CONFLICT (email) DO UPDATE 
            SET otp = $2, user_data = $3, expires_at = NOW() + INTERVAL '5 minutes'
        `, [email, otp, JSON.stringify(req.body)]);

        await mailer.sendOTP(email, otp);
        res.json({ message: "Mã OTP đã được gửi vào Email" });
    } catch (error) {
        console.log(error);
        res.status(500).json("Không thể gửi OTP" + error);
    }
};

// API 2: Xác thực và Tạo User (Hàm register của bạn bây giờ sẽ gọi ở đây)
exports.verifyAndRegister = async (req, res) => {
    try {
        const { email, otp } = req.body;

        // 1. Kiểm tra OTP
        const result = await pool.query(
            "SELECT * FROM otp_verification WHERE email = $1 AND otp = $2 AND expires_at > NOW()",
            [email, otp]
        );

        if (result.rows.length === 0) {
            return res.status(400).json("Mã OTP không đúng hoặc đã hết hạn");
        }

        // 2. Lấy dữ liệu user đã lưu tạm để tạo tài khoản thật
        const userData = result.rows[0].user_data;
        const hash = await bcrypt.hash(userData.password, 10);
        
        const user = {
            user_id: uuidv4(),
            username: userData.username,
            email: userData.email,
            avatar: userData.avatar || `https://api.dicebear.com/7.x/avataaars/png?seed=${userData.username}`,
            password: hash,
            is_online: true,
            create_at: new Date()
        };

        const finalResult = await userModel.createUser(user);
        
        // 3. Xóa OTP sau khi dùng xong
        await pool.query("DELETE FROM otp_verification WHERE email = $1", [email]);

        res.json(finalResult.rows[0]);
    } catch (error) {
        res.status(500).json("Đăng ký thất bại");
    }
};

exports.login = async (req, res) => {
    try {
        const {email, password} = req.body;

        const result = await userModel.findUser(email);
        if(!result || result.rows.length === 0) return res.status(400).json({message: "User not found"});

        const user = result.rows[0];

        const match = await bcrypt.compare(password, user.password);

        if(!match) return res.status(400).json("Wrong password");

        const token = jwt.sign(
            {id: user.user_id, email: user.email},
            "SECRET" || "fallback_secret",
            {expiresIn: '7d'}
        );

        const {password: _, ...safeUserInfo} = user;
        return res.json({
            message: "Login success",
            token,
            user: safeUserInfo
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({message: "Login failure!", error: error.message});
    }
}   

exports.me = async(req,res)=>{

 const user = await pool.query(
 `SELECT * FROM Account WHERE user_id=$1`,
 [req.user.id]
 );

 res.json(user.rows[0]);

};


exports.updateProfile = async (req, res) => {
    try {
        const {
            username,
            name,
            email,
            phone,
        } = req.body;

        const finalUsername = username || name;

        let finalAvatar = req.body.avatar;

        if(req.file) {
            const file = req.file;
            finalAvatar = await uploadFile(file);
        }

        const result = await pool.query(
            `
            UPDATE Account
            SET
                username = COALESCE($1, username),
                email = COALESCE($2, email),
                phone = COALESCE($3, phone),
                avatar = COALESCE($4, avatar)
            WHERE user_id = $5
            RETURNING *
            `,
            [finalUsername, email, phone, finalAvatar, req.user.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({message: "User not found"});
        }

        const {password: _, ...safeUserInfo} = result.rows[0];
        res.json({message: "updated", user: safeUserInfo});
    } catch (error) {
        console.log(error);
        res.status(500).json({message: "Failed to update profile"});
    }
};

exports.findAccount = async(req, res) => {
    try {
        const {value} = req.body;

        if(!value) return res.status(400).json({error: "Missing value"});

        const result = await userModel.findUser(value);

        if(result.rows.length === 0) return res.status(400).json({error: "User not found"});

        res.json(result.rows[0]);
    } catch(err) {
        console.error(err);
        res.status(500).json({error: "find account failure"});
    }
}


exports.logout = async(req,res)=>{
    try {
        const result = await pool.query(`
        UPDATE Account 
            SET is_online = false, 
            last_seen = NOW() 
        WHERE user_id = $1 
        RETURNING *
    `, [req.user.id]);

    res.json({message:"logout success"});
    } catch (error) {
        console.error("logout failure " + error);
        res.status(500).json({error: "logout failure"});
    }

};

exports.forgotPasswordRequest = async (req, res) => {
    try {
        const { email } = req.body;

        const userCheck = await pool.query("SELECT * FROM Account WHERE email = $1", [email]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json("Email này chưa được đăng ký!");
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        await pool.query(`
            INSERT INTO otp_verification (email, otp, expires_at, user_data)
            VALUES ($1, $2, NOW() + INTERVAL '5 minutes', '{"type": "reset_password"}')
            ON CONFLICT (email) DO UPDATE SET otp = $2, expires_at = NOW() + INTERVAL '5 minutes'
        `, [email, otp]);

        await mailer.sendOTP(email, otp);
        res.json({ message: "Mã khôi phục đã được gửi vào Email" });
    } catch (error) {
        console.error(error);
        res.status(500).json("Lỗi hệ thống");
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const otpResult = await pool.query(
            "SELECT * FROM otp_verification WHERE email = $1 AND otp = $2 AND expires_at > NOW()",
            [email, otp]
        );

        if (otpResult.rows.length === 0) {
            return res.status(400).json("Mã xác thực không đúng hoặc hết hạn");
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query("UPDATE Account SET password = $1 WHERE email = $2", [hash, email]);

        await pool.query("DELETE FROM otp_verification WHERE email = $1", [email]);

        res.json({ message: "Đặt lại mật khẩu thành công!" });
    } catch (error) {
        console.error(error);
        res.status(500).json("Không thể đặt lại mật khẩu");
    }
};