exports.startCall = async(req,res)=>{

 const {conversationId,callType} = req.body;

 const call = await pool.query(
 `
 INSERT INTO Call
 VALUES(uuid_generate_v4(),$1,$2,$2,$3,'missed',NOW(),NULL)
 RETURNING *
 `,
 [conversationId,req.user.id,callType]
 );

 res.json(call.rows[0]);

};


exports.endCall = async(req,res)=>{

 await pool.query(
 `
 UPDATE Call
 SET status='completed', end_time=NOW()
 WHERE call_id=$1
 `,
 [req.body.callId]
 );

 res.json({message:"call ended"});

};


exports.history = async(req,res)=>{

 const result = await pool.query(
 `
 SELECT * FROM Call
 WHERE caller_id=$1
 `,
 [req.user.id]
 );

 res.json(result.rows);

};