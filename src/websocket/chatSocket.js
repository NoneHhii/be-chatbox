const pool = require("../config/db");

module.exports = (io) => {

  io.on("connection", async (socket) => {

    console.log("User connected", socket.id);

    socket.on("user_online", async (userId) => {

      await pool.query(
        `UPDATE Account SET is_online=true WHERE user_id=$1`,
        [userId]
      );

      await pool.query(
        `INSERT INTO User_socket(user_id,socket_id)
         VALUES($1,$2)
         ON CONFLICT(user_id)
         DO UPDATE SET socket_id=$2`,
        [userId, socket.id]
      );

      io.emit("user_status", {
        userId,
        status: "online"
      });

    });

    socket.on("disconnect", async () => {

      const result = await pool.query(
        "SELECT user_id FROM User_socket WHERE socket_id=$1",
        [socket.id]
      );

      if (result.rows.length) {

        const userId = result.rows[0].user_id;

        await pool.query(
          `UPDATE Account SET is_online=false WHERE user_id=$1`,
          [userId]
        );

        io.emit("user_status", {
          userId,
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