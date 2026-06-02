const pool = require("../config/db");
const {v4: uuidv4} = require("uuid");
const {uploadFile} = require('../services/file.service');

exports.createConversation = async (req, res) => {
    try {
        const {name, type, create_at, avatar} = req.body;
        const userId = req.user.user_id;

        const querry = `
            INSERT INTO Conversation 
            (conversation_id, name, type, create_by, create_at, avatar) 
            VALUES($1, $2, $3, $4, $5, $6) 
            RETURNING *
        `;

        const result = await pool.query(querry, [
            uuidv4(),
            name,
            type,
            userId,
            create_at,
            avatar
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.log(error);
        res.status(500).json({message: "Create failure"});
    }
}

exports.getConversations = async (req, res) => {
    // console.log("conver", req.user.id);
    
    try {
        const result = await pool.query(`
            SELECT DISTINCT ON (c.conversation_id) 
                c.conversation_id, 
                CASE 
                    WHEN c.type = 'private' THEN a.username 
                    ELSE c.name 
                END AS name, 
                c.type, 
                CASE 
                    WHEN c.type = 'private' THEN a.avatar 
                    ELSE c.avatar 
                END AS avatar, 
                CASE 
                    WHEN m.message_type = 'image' THEN '[Hình ảnh]' 
                    WHEN m.message_type = 'voice' THEN '[Tin nhắn thoại]' 
                    ELSE m.content 
                END AS last_message, 
                m.create_at AS last_time_message, 
                m.sender_id AS last_sender_id,  
                a.username AS last_sender_name, 
                a.user_id AS friend_id 
            FROM conversation c 
            JOIN conversation_member cm ON cm.conversation_id = c.conversation_id 
            LEFT JOIN conversation_member cm2 ON cm2.conversation_id = c.conversation_id AND cm2.user_id != cm.user_id 
            LEFT JOIN account a ON a.user_id = cm2.user_id 
            LEFT JOIN message m ON m.conversation_id = c.conversation_id 
            WHERE cm.user_id = $1 
            ORDER BY c.conversation_id, m.create_at DESC
            `,
            [req.user.id]
        );

        // 'cc478484-3f21-4728-922a-801108d766cf' 
        res.json(result.rows);
    } catch (error) {
        console.log(error);
        res.status(500).json({message: "Create failure"});
    }
}

exports.addMember = async (req, res) => {
    const { userId } = req.body; // ID người được thêm
    const conversation_id = req.params.id;
    const io = req.app.get("socketio");

    try {
        // 1. Thêm vào DB
        await pool.query(
            `INSERT INTO Conversation_member (id, conversation_id, user_id, role, join_at)
             VALUES (uuid_generate_v4(), $1, $2, 'member', NOW())
             ON CONFLICT DO NOTHING`,
            [conversation_id, userId]
        );

        // 2. Lấy thông tin nhóm để gửi qua Socket
        const groupInfo = await pool.query(
            "SELECT * FROM Conversation WHERE conversation_id = $1",
            [conversation_id]
        );

        // 3. Socket: Báo cho người được thêm
        if (io) {
            io.to(userId).emit("added_to_group", groupInfo.rows[0]);
            // Báo cho những người đang ở trong nhóm biết có thành viên mới
            io.to(conversation_id).emit("new_member_joined", { 
                conversation_id, 
                userId 
            });
        }

        res.json({ message: "member added", group: groupInfo.rows[0] });
    } catch (err) {
        res.status(500).json(err.message);
    }
};


exports.getOrCreateConversation = async (req, res) => {
  const senderId = req.user.id;

  const {
    receiverIds = [],
    name,
    avatar,
    type = "private",
    converId,
  } = req.body;

  if (
    !Array.isArray(receiverIds) ||
    receiverIds.length === 0
  ) {
    return res
      .status(400)
      .json("Thiếu receiverIds");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    console.log("conver: ", converId);
    

    /* ======================================
       1. OPEN EXISTING BY ID
    ====================================== */
    if (converId) {
      const result = await client.query(
        `
        SELECT DISTINCT ON (c.conversation_id)
          c.conversation_id,
          c.name,
          c.type,
          c.avatar,

          m.content AS last_message,
          m.create_at AS last_time_message,
          m.sender_id AS last_sender_id,
          a.username AS last_sender_name

        FROM conversation c

        JOIN conversation_member cm
          ON cm.conversation_id = c.conversation_id

        LEFT JOIN message m
          ON m.conversation_id = c.conversation_id

        LEFT JOIN account a
          ON a.user_id = m.sender_id

        WHERE c.conversation_id = $1
          AND cm.user_id = $2

        ORDER BY c.conversation_id, m.create_at DESC
        `,
        [converId, senderId]
      );

      if (result.rows.length > 0) {
        await client.query("COMMIT");
        return res.json(result.rows[0]);
      }
    }

    /* ======================================
       2. PRIVATE CHAT
    ====================================== */
    if (
      type === "private" &&
      receiverIds.length === 1
    ) {
      const receiverId =
        receiverIds[0];

      const existing =
        await client.query(
          `
          SELECT DISTINCT ON (c.conversation_id)

            c.conversation_id,

            u.username AS name,
            u.avatar,

            c.type,

            m.content AS last_message,
            m.create_at AS last_time_message,
            m.sender_id AS last_sender_id,
            sender.username AS last_sender_name

          FROM conversation c

          JOIN conversation_member me
            ON me.conversation_id = c.conversation_id

          JOIN conversation_member other_user
            ON other_user.conversation_id = c.conversation_id

          JOIN account u
            ON u.user_id = other_user.user_id

          LEFT JOIN message m
            ON m.conversation_id = c.conversation_id

          LEFT JOIN account sender
            ON sender.user_id = m.sender_id

          WHERE c.type='private'
            AND me.user_id = $1
            AND other_user.user_id = $2

          ORDER BY c.conversation_id, m.create_at DESC
          `,
          [senderId, receiverId]
        );

      if (
        existing.rows.length > 0
      ) {
        await client.query(
          "COMMIT"
        );

        return res.json(
          existing.rows[0]
        );
      }

      /* create new private */
      const newConvId =
        uuidv4();

      await client.query(
        `
        INSERT INTO conversation(
          conversation_id,
          name,
          type,
          create_by,
          create_at,
          avatar
        )
        VALUES(
          $1,
          null,
          'private',
          $2,
          NOW(),
          null
        )
        `,
        [
          newConvId,
          senderId,
        ]
      );

      for (const uid of [
        senderId,
        receiverId,
      ]) {
        await client.query(
          `
          INSERT INTO conversation_member(
            id,
            conversation_id,
            user_id,
            role,
            join_at
          )
          VALUES(
            $1,
            $2,
            $3,
            'member',
            NOW()
          )
          `,
          [
            uuidv4(),
            newConvId,
            uid,
          ]
        );
      }

      await client.query(
        "COMMIT"
      );

      const io = req.app.get("socketio");
      if (io) {
          // Thông báo cho từng thành viên để họ cập nhật danh sách hội thoại
          [senderId, receiverId].forEach(uid => {
              if (uid !== senderId) {
                  io.to(uid).emit("added_to_group", {
                      ...created.rows[0],
                      last_message: "Bạn đã được thêm vào nhóm",
                      last_time_message: new Date()
                  });
              }
          });
      }

      return res.status(201).json({
        conversation_id:
          newConvId,
        type: "private",
        name: null,
        avatar: null,
        last_message: null,
        last_time_message: null,
        last_sender_id: null,
        last_sender_name: null,
      });
    }

    /* ======================================
       3. GROUP CHAT
    ====================================== */
    const newConvId =
      uuidv4();

    const created =
      await client.query(
        `
        INSERT INTO conversation(
          conversation_id,
          name,
          type,
          create_by,
          create_at,
          avatar
        )
        VALUES(
          $1,
          $2,
          'group',
          $3,
          NOW(),
          $4
        )
        RETURNING *
        `,
        [
          newConvId,
          name ||
            "Nhóm chat",
          senderId,
          avatar || null,
        ]
      );

    const allMembers = [
      ...new Set([
        senderId,
        ...receiverIds,
      ]),
    ];

    for (const uid of allMembers) {
      const role =
        uid === senderId
          ? "admin"
          : "member";

      await client.query(
        `
        INSERT INTO conversation_member(
          id,
          conversation_id,
          user_id,
          role,
          join_at
        )
        VALUES(
          $1,
          $2,
          $3,
          $4,
          NOW()
        )
        `,
        [
          uuidv4(),
          newConvId,
          uid,
          role,
        ]
      );
    }

    await client.query(
      "COMMIT"
    );

    const io = req.app.get("socketio");

    if(io) {
      allMembers.forEach((uid) => {
        io.to(uid).emit("conversation_created", {
          conversation_id: newConvId,
          name: name || "Nhóm chat",
          type: "group",
          avatar: avatar || created.rows[0].avatar,
          last_message: "Bắt đầu cuộc trò chuyện ngay",
          last_time_message: new Date().toISOString(),
          last_sender_id: null,
          last_sender_name: null,
        });
      });
    }

    return res
      .status(201)
      .json({
        ...created.rows[0],
        last_message: null,
        last_time_message: null,
        last_sender_id: null,
        last_sender_name: null,
      });
  } catch (error) {
    await client.query(
      "ROLLBACK"
    );

    console.log(error);

    return res
      .status(500)
      .json(
        "Lỗi tạo hội thoại"
      );
  } finally {
    client.release();
  }
};


exports.updateGroupInfo = async (req, res) => {
    const { conversation_id, name } = req.body;
    const userId = req.user.id;
    const io = req.app.get("socketio");
    let avatarUrl = req.body.avatar;

    try {
        // 1. Check quyền Admin
        const check = await pool.query(
            "SELECT role FROM conversation_member WHERE conversation_id = $1 AND user_id = $2",
            [conversation_id, userId]
        );
        if (check.rows[0]?.role !== 'admin') return res.status(403).json("Chỉ Admin mới có quyền");

        if (req.file) {
            avatarUrl = await uploadFile(req.file);
        }

        // 3. Cập nhật Database
        const result = await pool.query(
            "UPDATE conversation SET name = COALESCE($1, name), avatar = COALESCE($2, avatar) WHERE conversation_id = $3 RETURNING *",
            [name, avatarUrl, conversation_id]
        );

        const updatedGroup = result.rows[0];

        if (io) {
            io.to(conversation_id).emit("group_updated", updatedGroup);
        }

        res.json(updatedGroup);
    } catch (err) { res.status(500).json(err.message); }
};

// 2. Kick thành viên hoặc Rời nhóm
exports.removeMember = async (req, res) => {
    const { conversation_id, targetUserId } = req.body;
    const requestUserId = req.user.id;
    const io = req.app.get("socketio");

    try {
        // Nếu không phải tự rời nhóm thì phải check quyền Admin
        if (requestUserId !== targetUserId) {
            const check = await pool.query(
                "SELECT role FROM conversation_member WHERE conversation_id = $1 AND user_id = $2",
                [conversation_id, requestUserId]
            );
            if (check.rows[0]?.role !== 'admin') return res.status(403).json("Bạn không có quyền kick thành viên");
        }

        // Thực hiện xóa khỏi DB
        await pool.query(
            "DELETE FROM conversation_member WHERE conversation_id = $1 AND user_id = $2",
            [conversation_id, targetUserId]
        );

        // SOCKET: 
        if (io) {
            // 1. Gửi cho người bị kick để họ tự thoát màn hình chat
            io.to(targetUserId).emit("you_are_kicked", { conversation_id });
            
            // 2. Gửi cho những người còn lại trong nhóm biết có người vừa ra đi
            io.to(conversation_id).emit("member_left", { 
                conversation_id, 
                userId: targetUserId,
                isKicked: requestUserId !== targetUserId 
            });
        }

        res.json({ status: "success", message: "Đã rời/xóa thành viên" });
    } catch (err) { res.status(500).json(err.message); }
};

// 3. Chuyển quyền Admin
exports.setAdmin = async (req, res) => {
    const { conversation_id, targetUserId } = req.body;
    const adminId = req.user.id;
    const io = req.app.get("socketio");

    try {
        const check = await pool.query(
            "SELECT role FROM conversation_member WHERE conversation_id = $1 AND user_id = $2",
            [conversation_id, adminId]
        );
        if (check.rows[0]?.role !== 'admin') return res.status(403).json("Chỉ Admin mới có thể chỉ định Admin mới");

        await pool.query(
            "UPDATE conversation_member SET role = 'admin' WHERE conversation_id = $1 AND user_id = $2",
            [conversation_id, targetUserId]
        );

        if (io) {
            io.to(conversation_id).emit("new_admin_assigned", { conversation_id, newAdminId: targetUserId });
        }

        res.json("Đã chỉ định Admin mới thành công");
    } catch (err) { res.status(500).json(err.message); }
};

exports.getMembers = async (req, res) => {
    const { id } = req.params; // conversation_id
    try {
        const result = await pool.query(
            `SELECT a.user_id, a.username, a.avatar, cm.role 
             FROM conversation_member cm 
             JOIN account a ON a.user_id = cm.user_id 
             WHERE cm.conversation_id = $1`,
            [id]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json(err.message); }
};

// conversationController.js
exports.deleteGroup = async (req, res) => {
    const { id } = req.params; // conversationId
    const userId = req.user.id;
    const io = req.app.get("socketio");

    try {
        // 1. Kiểm tra quyền (Chỉ Admin/Chủ nhóm mới được giải tán)
        const checkAdmin = await pool.query(
            "SELECT role FROM Conversation_member WHERE conversation_id = $1 AND user_id = $2",
            [id, userId]
        );

        if (checkAdmin.rows[0]?.role !== 'admin') {
            return res.status(403).json("Chỉ Trưởng nhóm mới có quyền giải tán!");
        }

        // 2. Phát socket trước khi xóa để mọi người kịp nhận tin
        if (io) {
            io.to(id).emit("group_dissolved", { conversation_id: id });
        }

        // 3. Xóa dữ liệu (Ràng buộc khóa ngoại sẽ tự xóa member và message nếu Khoa để ON DELETE CASCADE)
        await pool.query("DELETE FROM Conversation WHERE conversation_id = $1", [id]);

        res.json({ message: "Nhóm đã được giải tán" });
    } catch (err) {
        res.status(500).json(err.message);
    }
};

// 1. Tìm kiếm tin nhắn theo từ khóa trong phòng chat
exports.searchMessages = async (req, res) => {
    const { conversationId, keyword } = req.query;
    try {
        const result = await pool.query(
            `SELECT * FROM Message 
             WHERE conversation_id = $1 AND message_type = 'text' AND message_text ILIKE $2
             ORDER BY created_at DESC`,
            [conversationId, `%${keyword}%`]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json(err.message); }
};

// 2. Thống kê kho Media (Ảnh/File)
exports.getCloudMedia = async (req, res) => {
    const { conversationId, type } = req.query; // type = 'image' hoặc 'file'
    try {
        const result = await pool.query(
            `SELECT message_id, message_text as url, created_at FROM Messages 
             WHERE conversation_id = $1 AND message_type = $2
             ORDER BY created_at DESC`,
            [conversationId, type]
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json(err.message); }
};

// 3. Ghim / Bỏ ghim trò chuyện
exports.togglePinConversation = async (req, res) => {
    const { conversationId, isPinned } = req.body;
    const userId = req.user.id; // UUID
    const io = req.app.get("socketio");

    try {
        await pool.query(
            `UPDATE Conversation_member 
             SET is_pinned = $1, pinned_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END
             WHERE conversation_id = $2 AND user_id = $3`,
            [isPinned, conversationId, userId]
        );

        // Bắn socket về room cá nhân của User để đồng bộ tất cả thiết bị (App/Web)
        if (io) {
            io.to(userId).emit("conversation_pinned", { conversationId, isPinned, pinnedAt: new Date() });
        }

        res.json({ message: isPinned ? "Đã ghim" : "Đã bỏ ghim" });
    } catch (err) { res.status(500).json(err.message); }
};

// 4. Ẩn trò chuyện bằng mã PIN
exports.hideConversation = async (req, res) => {
    const { conversationId, pinCode, isHidden } = req.body;
    const userId = req.user.id;
    const io = req.app.get("socketio");

    try {
        await pool.query(
            `UPDATE Conversation_member SET is_hidden = $1, hidden_pin_code = $2
             WHERE conversation_id = $3 AND user_id = $4`,
            [isHidden, isHidden ? pinCode : null, conversationId, userId]
        );

        if (io) {
            io.to(userId).emit("conversation_hidden", { conversationId, isHidden, pinCode });
        }

        res.json({ message: isHidden ? "Đã ẩn" : "Đã hiện" });
    } catch (err) { res.status(500).json(err.message); }
};

// 5. Tắt / Bật thông báo nhóm
exports.toggleMuteConversation = async (req, res) => {
    const { conversationId, isMuted } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `UPDATE Conversation_member SET is_muted = $1 WHERE conversation_id = $2 AND user_id = $3`,
            [isMuted, conversationId, userId]
        );
        res.json({ message: isMuted ? "Tắt thông báo thành công" : "Đã bật thông báo" });
    } catch (err) { res.status(500).json(err.message); }
};


// 6. Xóa bạn bè
exports.unfriend = async (req, res) => {
    const { friendId } = req.body;
    const userId = req.user.id;
    try {
        await pool.query(
            `DELETE FROM Friend 
             WHERE (user_id1 = $1 AND user_id2 = $2) OR (user_id1 = $2 AND user_id2 = $1)`,
            [userId, friendId]
        );
        res.json({ message: "Đã hủy kết bạn" });
    } catch (err) { res.status(500).json(err.message); }
};

// 7. Chặn người dùng
exports.blockUser = async (req, res) => {
    const { targetUserId } = req.body; // UUID người bị chặn
    const userId = req.user.id;        // UUID người chặn
    const io = req.app.get("socketio");

    try {
        await pool.query(
            `INSERT INTO BlockList (blocker_id, blocked_id) VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [userId, targetUserId]
        );

        // Bắn tín hiệu cho cả 2 người để cập nhật trạng thái block lập tức
        if (io) {
            // Báo cho người bị chặn
            io.to(targetUserId).emit("you_are_blocked", { blockedBy: userId });
            // Báo lại cho các thiết bị khác của người chặn
            io.to(userId).emit("user_blocked_success", { targetUserId });
        }

        res.json({ message: "Đã chặn người dùng này" });
    } catch (err) { res.status(500).json(err.message); }
};

exports.toggleMemberChatPermission = async (req, res) => {
    const { conversationId, targetUserId, canChat } = req.body;
    const io = req.app.get("socketio");
    try {
        await pool.query(
            `UPDATE Conversation_member SET can_send_message = $1 
             WHERE conversation_id = $2 AND user_id = $3`,
            [canChat, conversationId, targetUserId]
        );
        if (io) {
            io.to(conversationId).emit("member_permission_changed", { targetUserId, canChat, conversationId });
        }
        res.json({ message: "Cập nhật quyền thành viên thành công" });
    } catch (err) { res.status(500).json(err.message); }
};

// Giao lại quyền Trưởng nhóm (Chuyển nhượng Admin cao nhất)
exports.transferAdminRole = async (req, res) => {
    const { conversationId, newAdminId } = req.body;
    const currentAdminId = req.user.id;
    const io = req.app.get("socketio");
    try {
        // Hạ cấp Admin cũ xuống thành viên thường
        await pool.query(
            `UPDATE Conversation_member SET role = 'member' WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, currentAdminId]
        );
        // Cấp quyền Admin mới cho người được chọn
        await pool.query(
            `UPDATE Conversation_member SET role = 'admin' WHERE conversation_id = $1 AND user_id = $2`,
            [conversationId, newAdminId]
        );
        if (io) {
            io.to(conversationId).emit("admin_transferred", { conversationId, oldAdminId: currentAdminId, newAdminId });
        }
        res.json({ message: "Đã chuyển nhượng quyền trưởng nhóm thành công" });
    } catch (err) { res.status(500).json(err.message); }
};

exports.generateJoinCode = async (req, res) => {
    const { conversationId } = req.body;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase(); // Ví dụ: ABC123
    try {
        await pool.query(
            `UPDATE Conversation SET join_code = $1 WHERE conversation_id = $2`,
            [code, conversationId]
        );
        res.json({ join_code: code });
    } catch (err) { res.status(500).json(err.message); }
};

// Tham gia nhóm bằng mã Code công khai
exports.joinGroupByCode = async (req, res) => {
    const { code } = req.body;
    const userId = req.user.id;
    try {
        const group = await pool.query(`SELECT conversation_id, is_approval_required FROM Conversation WHERE join_code = $1`, [code]);
        if (group.rows.length === 0) return res.status(404).json("Mã nhóm không tồn tại!");
        
        const { conversation_id, is_approval_required } = group.rows[0];

        // Nếu nhóm cần duyệt, thêm vào trạng thái chờ duyệt (Hoặc thêm thẳng nếu không cần)
        await pool.query(
            `INSERT INTO Conversation_member (conversation_id, user_id, role) 
             VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
            [conversation_id, userId]
        );
        res.json({ conversationId: conversation_id, status: "success" });
    } catch (err) { res.status(500).json(err.message); }
};

exports.createPoll = async (req, res) => {
    const { conversationId, question, options } = req.body; // options là mảng chữ ['Thứ 2', 'Thứ 3']
    const userId = req.user.id;
    const io = req.app.get("socketio");
    try {
        const poll = await pool.query(
            `INSERT INTO Polls (conversation_id, creator_id, question) VALUES ($1, $2, $3) RETURNING *`,
            [conversationId, userId, question]
        );
        const pollId = poll.rows[0].poll_id;

        // Lưu các phương án lựa chọn
        for (let option of options) {
            await pool.query(`INSERT INTO Poll_options (poll_id, option_text) VALUES ($1, $2)`, [pollId, option]);
        }

        if (io) {
            io.to(conversationId).emit("new_poll_created", { conversationId, pollId, question });
        }
        res.json({ message: "Tạo bình chọn thành công", pollId });
    } catch (err) { res.status(500).json(err.message); }
};

exports.getGroupJoinCode = async (req, res) => {
    const { id } = req.params; // conversationId
    try {
        const result = await pool.query('SELECT join_code FROM Conversation WHERE conversation_id = $1', [id]);
        let code = result.rows[0]?.join_code;
        
        if (!code) {
            code = Math.random().toString(36).substring(2, 8).toUpperCase(); // Ví dụ: QR79X2
            await pool.query('UPDATE Conversation SET join_code = $1 WHERE conversation_id = $2', [code, id]);
        }
        res.json({ join_code: code });
    } catch (err) { res.status(500).json(err.message); }
};

// 2. Tạo nhắc hẹn mới và emit qua Socket để toàn nhóm nhìn thấy banner nhảy lên
exports.createReminder = async (req, res) => {
    const { id } = req.params; // conversationId
    const { title, remindAt } = req.body; // remindAt định dạng ISO string
    const userId = req.user.id;
    const io = req.app.get("socketio");

    try {
        const result = await pool.query(
            `INSERT INTO Reminders (conversation_id, creator_id, title, remind_at) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, userId, title, remindAt]
        );
        
        const newReminder = result.rows[0];

        // Bắn socket về phòng chat để cập nhật Banner Real-time công khai
        if (io) {
            io.to(id).emit("new_reminder", { conversationId: id, reminder: newReminder });
        }

        res.json(newReminder);
    } catch (err) { res.status(500).json(err.message); }
};

// 3. Xóa nhắc hẹn
exports.deleteReminder = async (req, res) => {
    const { reminderId } = req.params;
    const io = req.app.get("socketio");
    try {
        const check = await pool.query('SELECT conversation_id FROM Reminders WHERE reminder_id = $1', [reminderId]);
        if (check.rows.length === 0) return res.status(404).json("Không tìm thấy nhắc hẹn");
        
        const conversationId = check.rows[0].conversation_id;
        await pool.query('DELETE FROM Reminders WHERE reminder_id = $1', [reminderId]);

        if (io) {
            io.to(conversationId).emit("reminder_deleted", { conversationId, reminderId });
        }
        res.json({ message: "Đã xóa nhắc hẹn" });
    } catch (err) { res.status(500).json(err.message); }
};