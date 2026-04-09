const { types } = require("pg");
const pool = require("../config/db");
const {v4: uuidv4} = require('uuid');

exports.sendRequest = async (req, res) => {
    const senderId = req.user.id; // Đảm bảo Middleware Auth gán đúng user_id
    const { receiverId } = req.body;

    if (!receiverId) return res.status(400).json({ error: "Missing receiverId" });
    if (senderId === receiverId) return res.status(400).json({ error: "Cannot send to yourself" });

    try {
        const existingRequest = await pool.query(
            "SELECT * FROM FriendRequest WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)",
            [senderId, receiverId]
        );

        if (existingRequest.rows.length > 0) {
            return res.status(400).json({ error: "Request already exists or you are already friends" });
        }

        await pool.query(
            "INSERT INTO FriendRequest (friend_id, sender_id, receiver_id, status, create_at) VALUES ($1, $2, $3, 'pending', NOW())",
            [uuidv4(), senderId, receiverId]
        );

        res.json({ message: "Friend request sent successfully" });

    } catch (error) {
        console.error("Send Request DB Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


exports.acceptRequest = async(req,res)=>{

    const {id} = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const requestResult = await client.query(`
            UPDATE FriendRequest SET status = 'accepted' WHERE friend_id = $1 RETURNING receiver_id, sender_id 
        `, [id]);

        if(requestResult.rowCount === 0) {
            throw new Error("Không tìm thấy lời mời kết bạn này.");
        }

        const { sender_id, receiver_id } = requestResult.rows[0];

        await client.query(`
            INSERT INTO Friend (friendId, user_id1, user_id2) VALUES ($1 ,$2, $3) 
        `, [uuidv4(), sender_id, receiver_id]);

        await client.query('COMMIT');

        // Socket
        const io = req.app.get('io');
        if(io) {
            io.to(sender_id).emit('notification', {
                type: "FRIEND_ACCEPTED",
                message: "Yêu cầu kết bạn của bạn đã được chấp nhận",
                from: receiver_id
            });
        }

        res.json("Friend correct");
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log(error);
        
    } finally {
        client.release();
    }

};

exports.getRequests = async(req,res)=>{
    try {
        const result = await pool.query(`
        SELECT fr.create_at as request_create_at, fr.status as request_status, fr.friend_id, u.* FROM FriendRequest fr 
        JOIN Account u ON fr.sender_id = u.user_id 
        WHERE fr.receiver_id = $1 AND fr.status = 'pending' 
        ORDER BY fr.create_at DESC
    `,
    [req.user.id]);

    res.json(result.rows);
    } catch (error) {
        console.error("Getting request failure!");
        throw error;
    }

};



exports.getFriends = async(req,res)=>{

    try {
        const result = await pool.query(`
        SELECT u.* FROM friend fr 
        JOIN Account u ON ( 
            CASE 
                WHEN fr.user_id1 = $1 THEN fr.user_id2 = u.user_id
                WHEN fr.user_id2 = $1 THEN fr.user_id1 = u.user_id 
            END
        )
        WHERE fr.user_id1 = $1 OR fr.user_id2 = $1 
        ORDER BY fr.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
    } catch (error) {
        console.log("Getting friend failure, ", error);
        throw error;
        
    }

};


exports.rejectFriendRequest = async (req, res) => {
    const requestId = req.params.id;
    const currentUserId = req.user.user_id; // Lấy từ middleware auth

    try {
        const result = await pool.query(
            `
            DELETE FROM FriendRequest
            WHERE friend_id = $1 AND receiver_id = $2
            RETURNING *;
            `,
            [requestId, currentUserId]
        );

        // Kiểm tra xem có thực sự xóa được dòng nào không
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Không tìm thấy lời mời hoặc bạn không có quyền xóa" });
        }

        res.json({ message: "Đã từ chối lời mời kết bạn" });
    } catch (error) {
        console.error("Reject Request Error:", error);
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
};