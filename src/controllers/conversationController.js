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
    try {
        const result = await pool.query(
            "SELECT * FROM Conversation"
        );

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