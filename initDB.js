const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "123456",
  database: "chatbox",
});

async function init() {
  try {
    await client.connect();
    console.log("Connected to DB");

    // const schema = fs.readFileSync(
    //   path.join(__dirname, "database/schema.sql"),
    //   "utf8"
    // );

    // await client.query(schema);

    const seed = fs.readFileSync(
  path.join(__dirname, "database/seed.sql"),
  "utf8"
);

await client.query(seed);

    console.log("Schema imported successfully");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

init();