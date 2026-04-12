const pool = require("../config/db");

module.exports = (io) => {
  io.on("connection", async (socket) => {
    console.log("User connected:", socket.id);

    // 1. Khi User báo danh Online
    socket.on("user_online", async (userId) => {
      socket.userId = userId;
      socket.join(userId); // Join vào phòng cá nhân (để nhận notify riêng)

      await pool.query(
        `UPDATE Account SET is_online=true WHERE user_id=$1`,
        [userId]
      );

      // Báo cho mọi người biết mình vừa online
      io.emit("user_status", { userId, status: "online" });
    });

    // 2. QUAN TRỌNG: Vào phòng chat cụ thể
    socket.on("join_conversation", (conversationId) => {
      socket.join(conversationId);
      console.log(`User ${socket.userId} đã vào phòng chat: ${conversationId}`);
    });

    // 3. Rời phòng chat
    socket.on("leave_conversation", (conversationId) => {
      socket.leave(conversationId);
      console.log(`User ${socket.userId} đã rời phòng: ${conversationId}`);
    });

    // 4. Xử lý Disconnect
    socket.on("disconnect", async () => {
      if (socket.userId) {
        // Lưu ý: Thực tế nên check xem còn socket nào khác của User này online không
        // Nhưng đồ án thì Khoa cứ làm thế này cho đơn giản:
        await pool.query(
          `UPDATE Account SET is_online=false, last_seen=NOW() WHERE user_id=$1`,
          [socket.userId]
        );

        io.emit("user_status", {
          userId: socket.userId,
          status: "offline"
        });
      }
      console.log("User disconnected:", socket.id);
    });

    // 5. Typing - Dùng socket.to() để gửi cho người kia (không gửi cho chính mình)
    socket.on("typing_start", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("typing_start", { userId, conversationId });
    });

    socket.on("typing_stop", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("typing_stop", { userId, conversationId });
    });

    // 6. Call Signalling (Nên dùng Room hoặc UserId để gửi chính xác hơn)
    socket.on("call_user", (data) => {
      // Gửi đến UserId của người nhận thay vì socketId (ổn định hơn)
      io.to(data.targetUserId).emit("incoming_call", data);
    });

    socket.on("answer_call", (data) => {
      io.to(data.callerId).emit("call_answered", data);
    });

    socket.on("end_call", (data) => {
      io.to(data.conversationId).emit("call_ended");
    });
  });
};