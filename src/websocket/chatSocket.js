const jwt = require("jsonwebtoken");
const pool = require("../config/db");
require("dotenv").config();

module.exports = (io) => {
  // MIDDLEWARE KIỂM TRA AND XÁC THỰC TOKEN
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error("Authentication error: Invalid token"));
      }
      // Gán userId giải mã từ token vào socket
      socket.userId = decoded.id; 
      next();
    });
  });

  io.on("connection", async (socket) => {
    console.log(`User authenticated: ${socket.userId} | Socket ID: ${socket.id}`);
    
    // Đưa Socket hiện tại vào phòng cá nhân định danh theo userId
    socket.join(socket.userId);

    // Tự động cập nhật trạng thái Online vào cơ sở dữ liệu
    try {
        await pool.query(
            `UPDATE Account SET is_online=true WHERE user_id=$1`,
            [socket.userId]
        );
        io.emit("user_status", { userId: socket.userId, status: "online" });
    } catch (error) {
        console.error("Lỗi tự động set online:", error.message);
    }

    // 1. Khi User chủ động báo danh Online (Giữ để dự phòng)
    socket.on("user_online", async (userId) => {
      if (!userId) return;
      try {
        socket.userId = userId;
        socket.join(userId);

        await pool.query(
          `UPDATE Account SET is_online=true WHERE user_id=$1`,
          [userId]
        );
        io.emit("user_status", { userId, status: "online" });
      } catch (err) {
        console.error("Lỗi user_online:", err.message);
      }
    });

    // 2. Vào phòng chat nhóm hoặc chat 1-1
    socket.on("join_conversation", (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationId);
      console.log(`User ${socket.userId} đã gia nhập phòng: ${conversationId}`);
    });

    // 3. Rời phòng chat
    socket.on("leave_conversation", (conversationId) => {
      if (!conversationId) return;
      socket.leave(conversationId);
      console.log(`User ${socket.userId} đã rời phòng: ${conversationId}`);
    });

    // 4. Typing Indicators
    socket.on("typing_start", ({ conversationId, userId }) => {
      if (conversationId) {
        socket.to(conversationId).emit("typing_start", { userId, conversationId });
      }
    });

    socket.on("typing_stop", ({ conversationId, userId }) => {
      if (conversationId) {
        socket.to(conversationId).emit("typing_stop", { userId, conversationId });
      }
    });

    // =========================================================
    // KHỐI XỬ LÝ LẮNG NGHE & CHUYỂN TIẾP TÍN HIỆU CUỘC GỌI (WEBRTC)
    // =========================================================

    // A. Phát thông báo cuộc gọi đến (Để App nhận biết tự bật màn hình CallScreen lên)
    socket.on("call_user", (data) => {
  if (!data.targetUserId) return;

  const target = io.to(data.targetUserId);

  switch (data.type) {
    case "webrtc:offer":
      target.emit("webrtc:offer", {
        ...data,
        fromUserId: socket.userId,
      });
      break;

    case "webrtc:answer":
      target.emit("webrtc:answer", {
        ...data,
        fromUserId: socket.userId,
      });
      break;

    case "webrtc:ice-candidate":
      target.emit("webrtc:ice-candidate", {
        ...data,
        fromUserId: socket.userId,
      });
      break;

    default:
      target.emit("incoming_call", {
        ...data,
        fromUserId: socket.userId,
      });
  }
});

    // Cổng phụ hồi đáp Answer dành cho Web gốc (giữ để không lỗi logic Web cũ)
    socket.on("answer_call", (data) => {
      if (data.callerId) {
        io.to(data.callerId).emit("call_answered", data);
      }
    });

    // Lắng nghe sự kiện cúp máy
    socket.on("end_call", (data) => {
      const convId = data.conversationId || data.id;
      if (convId) {
        console.log(`[Call] Cuộc gọi tại phòng ${convId} đã kết thúc.`);
        
        // Gửi thông báo đồng loạt cho cả phòng chat để đóng màn hình cuộc gọi ngay lập tức
        io.to(convId).emit("end_call", { conversationId: convId });
        io.to(convId).emit("call_ended", { conversationId: convId });
      }
    });

    // 5. Xử lý khi người dùng mất kết nối đột ngột hoặc đóng ứng dụng
    socket.on("disconnect", async () => {
      if (socket.userId && socket.userId !== 'undefined') {
        try {
          await pool.query(
            `UPDATE Account SET is_online=false, last_seen=NOW() WHERE user_id=$1`,
            [socket.userId]
          );

          io.emit("user_status", {
            userId: socket.userId,
            status: "offline"
          });
          console.log(`User ${socket.userId} offline.`);
        } catch (err) {
          console.error("Lỗi khi disconnect update DB:", err.message);
        }
      }
    });
  });
};