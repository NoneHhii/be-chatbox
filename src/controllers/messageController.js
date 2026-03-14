const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

exports.sendMessage = async (req, res) => {
    const { conversation_id, content, message_type = 'text' } = req.body;
    const sender_id = req.user.id;
    const message_id = uuidv4();

    try {
        await pool.query('BEGIN'); // Dùng Transaction để đảm bảo lưu cả Message và Attachment

        // 1. Lưu tin nhắn vào bảng Message
        // Lưu ý: message_type có thể là 'image', 'file', 'text'... tùy thuộc vào dữ liệu gửi lên
        const messageResult = await pool.query(
            `INSERT INTO Message (message_id, conversation_id, sender_id, content, message_type)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [message_id, conversation_id, sender_id, content, message_type]
        );

        const newMessage = messageResult.rows[0];

        // 2. Nếu có file đính kèm (Xử lý qua Multer + S3 trước đó)
        if (req.file) {
            const attachment_id = uuidv4();
            const file_url = req.file.location; // URL từ S3 sau khi upload
            
            await pool.query(
                `INSERT INTO Attachment (attachment_id, message_id, file_url, file_type, file_size)
                 VALUES ($1, $2, $3, $4, $5)`,
                [attachment_id, message_id, file_url, req.file.mimetype, req.file.size]
            );
            
            // Gắn thêm thông tin file vào object trả về để Frontend hiển thị luôn
            newMessage.attachment = { file_url, file_type: req.file.mimetype };
        }

        await pool.query('COMMIT');

        // 3. (Tùy chọn) Bắn Socket.io tại đây để người nhận thấy tin nhắn ngay lập tức
        // io.to(conversation_id).emit('new_message', newMessage);

        res.status(201).json(newMessage);

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error("Lỗi gửi tin nhắn:", err);
        res.status(500).json({ error: "Không thể gửi tin nhắn" });
    }
};

exports.getMessages = async (req, res) => {

 const { convId } = req.params;

 const limit = parseInt(req.query.limit) || 20;

 const cursor = req.query.cursor;

 let query = `
 SELECT *
 FROM Message
 WHERE conversation_id = $1
 `;

 const values = [convId];

 if (cursor) {
   query += ` AND create_at < $2`;
   values.push(cursor);
 }

 query += `
 ORDER BY create_at DESC
 LIMIT ${limit}
 `;

 const result = await pool.query(query, values);

 res.json({
   messages: result.rows.reverse(),
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

