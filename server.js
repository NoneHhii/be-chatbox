require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const {Server} = require("socket.io");

const authRoutes = require("./src/routes/authRoutes");
const messageRoutes = require("./src/routes/messageRoute");
const friendRoutes = require("./src/routes/friendRoute");
const conversationRoutes = require('./src/routes/conversationRoute');
const chatSocket = require("./src/websocket/chatSocket");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/conversations", conversationRoutes);

const server = http.createServer(app);

const io = new Server(server, {
    cors: {origin: "*"}

});

app.set('socketio', io);

require("./src/websocket/notification")(io);
require("./src/websocket/chatSocket")(io);
server.listen(5000, () => {
    console.log("Server running on port http://localhost:5000");
    
})