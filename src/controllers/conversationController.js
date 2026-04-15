const pool = require("../config/db");
const {v4: uuidv4} = require("uuid");

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
    console.log("conver", req.user.id);
    
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

exports.addMember = async(req,res)=>{

 const {userId} = req.body;

 await pool.query(
 `
 INSERT INTO Conversation_member
 VALUES(uuid_generate_v4(),$1,$2,'member',NOW())
 `,
 [req.params.id,userId]
 );

 res.json({message:"member added"});

};


exports.getOrCreateConversation = async (req, res) => {
    const senderId = req.user.id;
    const { receiverId, name, avatar } = req.body;

    if (!receiverId) return res.status(400).json("Thiếu receiverId");

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const findQuery = `
            SELECT DISTINCT ON (c.conversation_id) 
                c.conversation_id, 
                a.username AS name, 
                c.type, 
                a.avatar AS avatar, 
                m.content AS last_message, 
                m.create_at AS last_time_message, 
                m.sender_id AS last_sender_id,  
                a.username AS last_sender_name 
            FROM conversation c 
            JOIN conversation_member cm ON cm.conversation_id = c.conversation_id 
            JOIN conversation_member cm2 ON cm2.conversation_id = c.conversation_id 
            JOIN account a ON a.user_id = cm.user_id 
            LEFT JOIN message m ON m.conversation_id = c.conversation_id 
            WHERE cm.user_id = $1 
                AND cm2.user_id = $2
                AND c.type = 'private' 
            ORDER BY c.conversation_id, m.create_at DESC
        `;
        
        const existing = await client.query(findQuery, [senderId, receiverId]);

        if (existing.rows.length > 0) {
            // ĐÃ CÓ: Trả về ID cũ luôn
            await client.query('COMMIT');
            return res.json( existing.rows[0] );
        }

        // CHƯA CÓ: Tiến hành tạo mới
        const newConvId = uuidv4();

        // 2. Tạo Conversation mới
        const createConvQuery = `
            INSERT INTO Conversation (conversation_id, name, type, create_by, create_at, avatar) 
            VALUES ($1, $2, 'private', $3, NOW(), $4) 
            RETURNING *;
        `;

        const newConvResult =await client.query(
            createConvQuery,
            [newConvId, name, senderId, avatar]
        );

        // 3. Thêm cả 2 vào Member (Dùng lặp hoặc 2 câu INSERT)
        const addMemberQuery = `INSERT INTO Conversation_member (id, conversation_id, user_id, role, join_at) VALUES ($1, $2, $3, $4, NOW())`;
        await client.query(addMemberQuery, [uuidv4(), newConvId, senderId, 'member']);
        await client.query(addMemberQuery, [uuidv4(), newConvId, receiverId, 'member']);

        await client.query('COMMIT');
        res.status(201).json(newConvResult.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json("Lỗi tạo hội thoại");
    } finally {
        client.release();
    }
};