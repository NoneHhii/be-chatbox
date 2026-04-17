const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const {uploadFile} = require('../services/file.service');


exports.sendMessage = async (req, res) => {
    const { conversation_id, content, message_type = 'text' } = req.body;
    const sender_id = req.user.id;
    
    const currentTime = new Date();
    const client = await pool.connect();

    try {
        const io = req.app.get("socketio");
        await client.query('BEGIN');
        const sentMessages = []; // Dùng Transaction để đảm bảo lưu cả Message và Attachment

        if(req.files && req.files.length > 0 ) {

            const uploadPromise = req.files.map(file => uploadFile(file));
            const fileUrls = await Promise.all(uploadPromise);
            for(let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const message_id = uuidv4();
                const file_url = fileUrls[i];

                const finalContent = message_type === 'voice' ? '[Tin nhắn thoại]' : file.originalname;

                const messageResult = await client.query(
                    `INSERT INTO Message (message_id, conversation_id, sender_id, content, message_type, is_delete, create_at)
                    VALUES ($1, $2, $3, $4, $5, false, $6)
                    RETURNING *`,
                    [message_id, conversation_id, sender_id, finalContent, message_type, currentTime]
                );

                const newMessage = messageResult.rows[0];
                newMessage.file_url = file_url;

                await client.query(
                    `INSERT INTO Attachment (attachment_id, message_id, file_url, file_type, file_size)
                    VALUES ($1, $2, $3, $4, $5)`,
                    [uuidv4(), message_id, file_url, file.mimetype, file.size]
                );

                sentMessages.push(newMessage);
            }
            if (io) io.to(conversation_id).emit('new_messages_batch', sentMessages);
        } else {
            // 1. Lưu tin nhắn vào bảng Message
            // Lưu ý: message_type có thể là 'image', 'file', 'text'... tùy thuộc vào dữ liệu gửi lên
            const messageResult = await client.query(
                `INSERT INTO Message (message_id, conversation_id, sender_id, content, message_type, is_delete, create_at)
                VALUES ($1, $2, $3, $4, $5, false, $6)
                RETURNING *`,
                [uuidv4(), conversation_id, sender_id, content, message_type, currentTime]
            );

            sentMessages.push(messageResult.rows[0]);
            if(io) io.to(conversation_id).emit('new_message', messageResult.rows[0]);
        }

        await client.query('COMMIT');

        res.status(201).json(sentMessages);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Lỗi gửi tin nhắn:", err);
        res.status(500).json({ error: "Không thể gửi tin nhắn" });
    } finally {
        client.release();
    }
};

exports.getMessages = async (req, res) => {

    const { convId } = req.params;

    const {limit} = parseInt(req.query.limit) || 20;

    const cursor = req.query.cursor;
    const userId = req.user.id;

    let query = `
        SELECT m.*, a.file_url, a.file_size FROM public.message m
        LEFT JOIN public.attachment a ON a.message_id = m.message_id
        WHERE m.conversation_id = $1 
        AND NOT EXISTS (
            SELECT 1 FROM Message_Deleted_By_User d 
            WHERE d.message_id = m.message_id AND d.user_id = $2
        )
    `;

    const values = [convId, userId];

    if (cursor) {
        query += ` AND m.create_at < $2`;
        values.push(cursor);
    }

    query += ` ORDER BY m.create_at DESC LIMIT $${values.length + 1}`;
    values.push(limit);

    const result = await pool.query(query, values);

    res.json({
    messages: result.rows,
    nextCursor:
        result.rows.length
        ? result.rows[result.rows.length - 1].create_at
        : null
    });

};

exports.searchMessage = async (req, res) => {

 const { convId, q } = req.query;

 const result = await pool.query(
 `
 SELECT *
 FROM Message
 WHERE conversation_id = $1
 AND to_tsvector(content)
 @@ plainto_tsquery($2)
 ORDER BY create_at DESC
 LIMIT 50
 `,
 [convId, q]
 );

 res.json(result.rows);

};

exports.getConversations = async (req, res) => {

 const result = await pool.query(
 `
 SELECT
  c.conversation_id,
  c.name,
  c.avatar,
  m.content AS last_message,
  m.create_at AS last_time

 FROM Conversation_member cm

 JOIN Conversation c
 ON c.conversation_id = cm.conversation_id

 LEFT JOIN LATERAL (

   SELECT content, create_at
   FROM Message
   WHERE conversation_id = c.conversation_id
   ORDER BY create_at DESC
   LIMIT 1

 ) m ON TRUE

 WHERE cm.user_id = $1

 ORDER BY m.create_at DESC
 `,
 [req.user.id]
 );

 res.json(result.rows);

};

exports.markSeen = async (req, res) => {
    const { messageId } = req.body;
    const userId = req.user.id;

    try {
        await pool.query(
            `INSERT INTO Message_seen (id, message_id, user_id)
             VALUES (uuid_generate_v4(), $1, $2)
             ON CONFLICT (message_id, user_id) DO NOTHING`,
            [messageId, userId]
        );
        res.json({ status: "seen" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.uploadFile = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Không có file nào được tải lên" });

    // Trả về URL S3 để Frontend hiển thị preview trước khi nhấn "Gửi"
    res.json({
        url: req.file.location, // Đây là link https://s3...
        mimetype: req.file.mimetype,
        size: req.file.size
    });
};

exports.recallMessage = async(req, res) => {
    const {message_id} = req.body;
    const userId = req.user.id;
    const io = req.app.get('socketio');

    try {
        const result = await pool.query(
            `
                UPDATE message SET is_recalled = true 
                WHERE message_id = $1 AND sender_id = $2 RETURNING * 
            `,
            [message_id, userId]
        );

        if(result.rowCount === 0) res.status(403).json("Thu hồi lỗi");

        const updateMsg = result.rows[0];
        if(io) io.to(updateMsg.conversation_id).emit("message_recalled", {message_id});

        res.json({status: "success", message_id});
    } catch (error) {
        res.status(500).json(error.message);
    }
};

exports.deleteMessageForMe = async (req, res) => {
    const { message_id } = req.params;
    const userId = req.user.id;

    try {
        await pool.query(
            `INSERT INTO Message_Deleted_By_User (message_id, user_id) 
             VALUES ($1, $2) 
             ON CONFLICT DO NOTHING`, 
            [message_id, userId]
        );
        
        res.json({ status: "success", message: "Đã ẩn tin nhắn với bạn" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// exports.handleUpload = async (req, res) => {
//     try {
//         // Kiểm tra xem có file nào được gửi lên không
//         if (!req.files || req.files.length === 0) {
//             return res.status(400).json("Không có file nào được chọn");
//         }

//         // Dùng map để tạo danh sách các Promise upload
//         const uploadPromises = req.files.map(file => uploadFile(file));

//         // Đợi tất cả upload xong và lấy về mảng các URL từ CloudFront/S3
//         const fileUrls = await Promise.all(uploadPromises);

//         // Trường hợp 1: Nếu là Update Profile (chỉ lấy cái đầu tiên)
//         if (req.path.includes('profile')) {
//             const avatarUrl = fileUrls[0];
//             // ... Update DB cho Account ...
//             return res.json({ message: "Updated profile", avatar: avatarUrl });
//         }

//         // Trường hợp 2: Nếu là Chat (trả về toàn bộ danh sách URL)
//         res.json({
//             message: "Uploaded successfully",
//             urls: fileUrls // Trả về mảng để Frontend gửi qua Socket
//         });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json("Lỗi khi xử lý file");
//     }
// };