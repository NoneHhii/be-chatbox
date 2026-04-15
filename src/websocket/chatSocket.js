const jwt = require("jsonwebtoken");
const pool = require("../config/db");

module.exports = (io) => {
  // MIDDLEWARE KIỂM TRA TOKEN
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error("Authentication error: Invalid token"));
      }
      // Gán userId giải mã từ token vào socket luôn
      socket.userId = decoded.id; 
      next();
    });
  });

  io.on("connection", async (socket) => {
    // Lúc này socket.userId đã có sẵn và cực kỳ an toàn
    console.log(`User authenticated: ${socket.userId}`);
    socket.join(socket.userId);

    // Tự động set Online luôn, không cần đợi client emit "user_online"
    try {
        await pool.query(
            `UPDATE Account SET is_online=true WHERE user_id=$1`,
            [socket.userId]
        );
        io.emit("user_status", { userId: socket.userId, status: "online" });
    } catch (error) {
        console.error("Lỗi tự động set online:", error.message);
    }

    // Các sự kiện khác giữ nguyên, không cần check undefined nữa
    socket.on("join_conversation", (conversationId) => {
      socket.join(conversationId);
    });

    console.log("Socket connected:", socket.id);

    // 1. Khi User báo danh Online
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

    // 2. Vào phòng chat
    socket.on("join_conversation", (conversationId) => {
      if (!conversationId) return;
      socket.join(conversationId);
      const uid = socket.userId || "Unknown";
      console.log(`User ${uid} đã vào phòng chat: ${conversationId}`);
    });

    // 3. Rời phòng chat
    socket.on("leave_conversation", (conversationId) => {
      if (!conversationId) return;
      socket.leave(conversationId);
      const uid = socket.userId || "Unknown";
      console.log(`User ${uid} đã rời phòng: ${conversationId}`);
    });

    // 4. Xử lý Disconnect
    socket.on("disconnect", async () => {
      // CHỈ Update DB nếu có userId hợp lệ
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
          console.log(`User ${socket.userId} disconnected and set offline`);
        } catch (err) {
          console.error("Lỗi khi disconnect update DB:", err.message);
        }
      } else {
        console.log("Anonymous socket disconnected:", socket.id);
      }
    });

    // 5. Typing
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

    // 6. Call Signalling
    socket.on("call_user", (data) => {
      if (data.targetUserId) {
        io.to(data.targetUserId).emit("incoming_call", data);
      }
    });

    socket.on("answer_call", (data) => {
      if (data.callerId) {
        io.to(data.callerId).emit("call_answered", data);
      }
    });

    socket.on("end_call", (data) => {
      if (data.conversationId) {
        io.to(data.conversationId).emit("call_ended");
      }
    });
  });
};