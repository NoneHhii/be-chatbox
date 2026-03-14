require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const {Server} = require("socket.io");

const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoute");
const chatSocket = require("./websocket/chatSocket");
const { log } = require("console");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoutes);

const server = http.createServer(app);

const io = new Server(server, {
    cors: {origin: "*"}

});

chatSocket(io);

server.listen(5000, () => {
    console.log("Server running on port 5000");
    
})