const pool = require("../config/db");

module.exports = (io) => {

  io.on("connection", async (socket) => {

    console.log("User connected", socket.id);

    socket.on("user_online", async (userId) => {
      socket.userId = userId;
      socket.join(userId);

      await pool.query(
        `UPDATE Account SET is_online=true WHERE user_id=$1`,
        [userId]
      );

      io.emit("user_status", {
        userId,
        status: "online"
      });

    });

    socket.on("disconnect", async () => {

      if(socket.userId) {

          await pool.query(
            `UPDATE Account SET is_online=false WHERE user_id=$1`,
            [socket.userId]
          );

          io.emit("user_status", {
            userId: socket.userId,
            status: "offline"
          });
      }

    });

    // typing
    socket.on("typing_start", ({conversationId,userId}) => {
        socket.to(conversationId).emit("typing_start", {
            userId
        });

    });

    socket.on("typing_stop", ({conversationId,userId}) => {

        socket.to(conversationId).emit("typing_stop", {
            userId
        });

    });

    // call signalling
    socket.on("call_user", (data) => {

    io.to(data.targetSocket).emit(
        "incoming_call",
        data
    );

    });

    socket.on("answer_call",(data)=>{

    io.to(data.targetSocket).emit(
        "call_answered",
        data
    );

    });

    socket.on("end_call",(data)=>{

    io.to(data.room).emit(
        "call_ended"
    );

    });

  });

};