exports.sendRequest = async(req,res)=>{
    const senderId = req.user.id;
    const {receiverId} = req.body;

    if(!receiverId) return res.status(400).json({err: "Missing receiverId"});

    if(senderId === receiverId) return res.status(400).json({err: "Cannot send yourself"});

    

 await pool.query(
 `
 INSERT INTO FriendRequest
 VALUES(uuid_generate_v4(),$1,$2,'pending',NOW())
 `,
 [req.user.id,receiverId]
 );

 res.json({message:"request sent"});

};


exports.acceptRequest = async(req,res)=>{

 const {id} = req.params;

 await pool.query(
 `
 UPDATE FriendRequest
 SET status='accepted'
 WHERE friend_id=$1
 `,
 [id]
 );

 res.json({message:"friend added"});

};


exports.getFriends = async(req,res)=>{

 const result = await pool.query(
 `
 SELECT * FROM FriendRequest
 WHERE (sender_id=$1 OR receiver_id=$1)
 AND status='accepted'
 `,
 [req.user.id]
 );

 res.json(result.rows);

};


exports.removeFriend = async(req,res)=>{

 await pool.query(
 `
 DELETE FROM FriendRequest
 WHERE friend_id=$1
 `,
 [req.params.id]
 );

 res.json({message:"friend removed"});

};