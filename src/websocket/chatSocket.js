// src/websocket/chatSocket.js

const jwt = require("jsonwebtoken");
const pool = require("../config/db");

module.exports = (io) => {
  /* ===================================
     AUTH SOCKET
  =================================== */
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(
          "Bearer ",
          ""
        );

      if (!token) {
        return next(
          new Error("Unauthorized")
        );
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET ||
          "SECRET"
      );

      socket.userId = decoded.id;

      next();
    } catch (error) {
      next(
        new Error("Invalid token")
      );
    }
  });

  /* ===================================
     CONNECTION
  =================================== */
  io.on(
    "connection",
    async (socket) => {
      const userId =
        socket.userId;

      console.log(
        "Connected:",
        userId,
        socket.id
      );

      try {
        /* room private */
        socket.join(userId);

        /* lưu socket */
        await pool.query(
          `
          INSERT INTO user_socket(
            id,
            user_id,
            socket_id
          )
          VALUES(
            gen_random_uuid(),
            $1,
            $2
          )
          `,
          [userId, socket.id]
        );

        /* online */
        await pool.query(
          `
          UPDATE account
          SET is_online=true
          WHERE user_id=$1
          `,
          [userId]
        );

        io.emit(
          "user_status",
          {
            userId,
            status:
              "online",
          }
        );
      } catch (error) {
        console.log(error);
      }

      /* ===================================
         JOIN ROOM CHAT
      =================================== */
      socket.on(
        "join_conversation",
        (
          conversationId
        ) => {
          socket.join(
            conversationId
          );

          console.log(
            `User ${userId} joined ${conversationId}`
          );
        }
      );

      socket.on(
        "leave_conversation",
        (
          conversationId
        ) => {
          socket.leave(
            conversationId
          );

          console.log(
            `User ${userId} left ${conversationId}`
          );
        }
      );

      /* ===================================
         TYPING
      =================================== */
      socket.on(
        "typing_start",
        ({
          conversationId,
        }) => {
          socket
            .to(
              conversationId
            )
            .emit(
              "typing_start",
              {
                userId,
              }
            );
        }
      );

      socket.on(
        "typing_stop",
        ({
          conversationId,
        }) => {
          socket
            .to(
              conversationId
            )
            .emit(
              "typing_stop",
              {
                userId,
              }
            );
        }
      );

      /* ===================================
         SEEN MESSAGE
      =================================== */
      socket.on(
        "seen_message",
        ({
          messageId,
          conversationId,
        }) => {
          socket
            .to(
              conversationId
            )
            .emit(
              "message_seen",
              {
                messageId,
                userId,
              }
            );
        }
      );

      /* ===================================
         CALLING
      =================================== */

      // caller -> target
      socket.on(
        "call_user",
        (data) => {
          io.to(
            data.targetUserId
          ).emit(
            "incoming_call",
            {
              ...data,
              callerId:
                userId,
            }
          );
        }
      );

      // target answer
      socket.on(
        "answer_call",
        (data) => {
          io.to(
            data.callerId
          ).emit(
            "call_answered",
            data
          );
        }
      );

      // reject
      socket.on(
        "reject_call",
        (data) => {
          io.to(
            data.callerId
          ).emit(
            "call_rejected"
          );
        }
      );

      // end call
      socket.on(
        "end_call",
        (data) => {
          io.to(
            data
              .conversationId
          ).emit(
            "call_ended"
          );
        }
      );

      /* ===================================
         DISCONNECT
      =================================== */
      socket.on(
        "disconnect",
        async () => {
          console.log(
            "Disconnect:",
            userId,
            socket.id
          );

          try {
            await pool.query(
              `
              DELETE FROM user_socket
              WHERE socket_id=$1
              `,
              [socket.id]
            );

            const remain =
              await pool.query(
                `
                SELECT id
                FROM user_socket
                WHERE user_id=$1
                `,
                [userId]
              );

            /* còn thiết bị khác */
            if (
              remain.rows
                .length === 0
            ) {
              await pool.query(
                `
                UPDATE account
                SET
                  is_online=false,
                  last_seen=NOW()
                WHERE user_id=$1
                `,
                [userId]
              );

              io.emit(
                "user_status",
                {
                  userId,
                  status:
                    "offline",
                }
              );
            }
          } catch (error) {
            console.log(error);
          }
        }
      );
    }
  );
};