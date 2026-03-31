const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {v4: uuidv4} = require('uuid');
const userModel = require("../models/userModel");

exports.register = async(req, res) => {
    try {
        const {username, email, phone, avatar, password, is_online, create_at} = req.body;

        const hash = await bcrypt.hash(password, 10);

        const user = [
            uuidv4(),
            username,
            email,
            phone,
            avatar,
            hash,
            is_online,
            create_at
        ];

        const result = await userModel.createUser(user);
        res.json(result.rows[0]);
    } catch (error) {
        console.log(error);
        res.status(500).json("Register failure!");
    }
}

exports.login = async (req, res) => {
    try {
        const {email, password} = req.body;

        const result = await userModel.findUser(email);
        if(!result || result.rows.length === 0) return res.status(400).json({message: "User not found"});

        const user = result.rows[0];

        const match = await bcrypt.compare(password, user.password);

        if(!match) return res.status(400).json("Wrong password");

        const token = jwt.sign(
            {id: user.user_id, email: user.email},
            "SECRET" || "fallback_secret",
            {expiresIn: '7d'}
        );

        const {password: _, ...safeUserInfo} = user;
        return res.json({
            message: "Login success",
            token,
            user: safeUserInfo
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({message: "Login failure!", error: error.message});
    }
}   

exports.me = async(req,res)=>{

 const user = await pool.query(
 `SELECT * FROM Account WHERE user_id=$1`,
 [req.user.id]
 );

 res.json(user.rows[0]);

};


exports.updateProfile = async(req,res)=>{

 const {username,avatar} = req.body;

 await pool.query(
 `
 UPDATE Account
 SET username=$1, avatar=$2
 WHERE user_id=$3
 `,
 [username,avatar,req.user.id]
 );

 res.json({message:"updated"});

};

exports.findAccount = async(req, res) => {
    try {
        const {value} = req.body;

        if(!value) return res.status(400).json({error: "Missing value"});

        const result = await userModel.findUser(value);

        if(result.rows.length === 0) return res.status(400).json({error: "User not found"});

        res.json(result.rows[0]);
    } catch(err) {
        console.error(err);
        res.status(500).json({error: "find account failure"});
    }
}


exports.logout = async(req,res)=>{

 res.json({message:"logout success"});

};