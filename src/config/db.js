const {Pool} = require('pg');
require('dotenv').config();

const pool = new Pool ({
    host: process.env.RDSHOST,
    user: "postgres",
    password: process.env.master_password,
    database: "postgres",
    post: 5432,
    ssl: {rejectUnauthorized: false},
});

module.exports = pool;

