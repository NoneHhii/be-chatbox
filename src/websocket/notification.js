module.exports = (io) => {
  // Bạn có thể dùng Namespace để tách biệt luồng dữ liệu
  const notify = io.of("/notifications");

  notify.on("connection", (socket) => {
    socket.on("join", (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined notification room`);
    });
  });
};