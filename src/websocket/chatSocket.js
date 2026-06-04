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
      if (data.targetUserId) {
        console.log(`[Call] ${socket.userId} đang gọi cho ${data.targetUserId}`);
        // .broadcast.to giúp gửi đến toàn bộ socket của targetUser NGOẠI TRỪ chính socket vừa gọi
        socket.broadcast.to(data.targetUserId).emit("incoming_call", {
          conversationId: data.conversationId || data.id,
          senderId: socket.userId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar,
          isVideo: data.isVideo === "true" || data.isVideo === true
        });
      }
    });

    // B. Lắng nghe và chuyển tiếp gói tín hiệu GỌI ĐI (webrtc:offer)
    socket.on("webrtc:offer", (data) => {
      if (data.to) {
        console.log(`[WebRTC] Gửi Offer từ ${socket.userId} -> ${data.to}`);
        socket.broadcast.to(data.to).emit("webrtc:offer", {
          senderId: socket.userId,
          signal: data.signal,
          isVideo: data.isVideo
        });
      }
    });

    // C. Lắng nghe và chuyển tiếp gói tín hiệu PHẢN HỒI (webrtc:answer)
    socket.on("webrtc:answer", (data) => {
      if (data.to) {
        console.log(`[WebRTC] Gửi Answer từ ${socket.userId} -> ${data.to}`);
        socket.broadcast.to(data.to).emit("webrtc:answer", {
          senderId: socket.userId,
          signal: data.signal
        });
      }
    });

    // D. Lắng nghe trao đổi cấu hình định tuyến mạng (webrtc:ice-candidate)
    socket.on("webrtc:ice-candidate", (data) => {
      if (data.to) {
        socket.broadcast.to(data.to).emit("webrtc:ice-candidate", {
          senderId: socket.userId,
          candidate: data.candidate
        });
      }
    });

    // E. Lắng nghe sự kiện gác máy cúp cuộc gọi
    socket.on("end_call", (data) => {
      if (data.conversationId) {
        console.log(`[Call] Cuộc gọi tại phòng ${data.conversationId} đã bị ngắt.`);
        // Gửi thông báo cho toàn bộ thành viên trong phòng chat lập tức đóng màn hình cuộc gọi
        io.to(data.conversationId).emit("end_call");
        io.to(data.conversationId).emit("call_ended"); // Đảm bảo đồng bộ cả 2 cổng Web/App
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