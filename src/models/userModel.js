const pool = require("../config/db");

exports.createUser = async(data) => {
    const query = `
        INSERT INTO Account(user_id, username, email, phone, avatar, password, is_online, create_at) 
        VALUES($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *
    `;
    return pool.query(query, data);
}

exports.findEmail = async (email) => {
    return await pool.query(
        "SELECT * FROM Account WHERE email = $1",
        [email]
    );
};