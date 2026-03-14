const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Lấy header Authorization
    const authHeader = req.headers.authorization;

    // Kiểm tra xem có header không và có bắt đầu bằng 'Bearer ' không
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json("Unauthorized: No token provided");
    }

    // Tách lấy phần token thực sự sau chữ 'Bearer '
    const token = authHeader.split(' ')[1];

    try {
        // "SECRET" nên để trong file .env nhé (process.env.JWT_SECRET)
        const decoded = jwt.verify(token, "SECRET");

        // Gán dữ liệu đã giải mã (thường là {id, email}) vào req.user
        req.user = decoded;

        next();
    } catch (error) {
        console.log("JWT Error:", error.message);
        res.status(401).json("Invalid or expired token");
    }
}