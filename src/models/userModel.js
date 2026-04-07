const pool = require("../config/db");

exports.createUser = async(data) => {
    const {user_id, username, email, phone, avatar, password, is_online, create_at} = data;
    const query = `
        INSERT INTO Account(user_id, username, email, phone, avatar, password, is_online, create_at) 
        VALUES($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *
    `;
    const values = [user_id, username, email, phone, avatar, password, is_online, create_at];
    return pool.query(query, values);
}

exports.findUser = async (value) => {
    return await pool.query(
        "SELECT * FROM Account WHERE email = $1 OR phone = $1",
        [value]
    );
};