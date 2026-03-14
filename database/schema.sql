CREATE TABLE Account (
    user_id UUID PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL UNIQUE,
    avatar TEXT,
    password VARCHAR(30) NOT NULL,
    is_online BOOLEAN DEFAULT FALSE,
    create_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE FriendRequest (
    friend_id UUID PRIMARY KEY,
    sender_id UUID REFERENCES Account(user_id) on DELETE CASCADE,
    receiver_id UUID REFERENCES Account(user_id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK(status IN ('pending', 'accepted', 'blocked')),
    create_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_friends_user ON FriendRequest(sender_id);

CREATE TABLE Conversation (
    conversation_id UUID PRIMARY KEY,
    name VARCHAR(225) NOT NULL,
    type VARCHAR(15) CHECK(type IN ('private', 'group')),
    create_by UUID REFERENCES Account(user_id) ON DELETE CASCADE,
    create_at TIMESTAMP DEFAULT NOW(),
    avatar TEXT
);

CREATE INDEX idx_conversation_type ON Conversation(type);

CREATE TABLE Conversation_member (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES Conversation(conversation_id) ON DELETE CASCADE,
    user_id UUID REFERENCES Account(user_id) ON DELETE CASCADE,
    role VARCHAR(15) CHECK(role IN ('admin', 'member')),
    join_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE Message (
    message_id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES Conversation(conversation_id) ON DELETE CASCADE,
    sender_id UUID REFERENCES Account(user_id) ON DELETE CASCADE,
    content TEXT,
    message_type VARCHAR(20) 
        CHECK(message_type IN ('text', 'audio', 'image', 'video', 'file', 'call')),
    is_delete BOOLEAN DEFAULT FALSE,
    create_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_message_conv_time
ON Message(conversation_id, create_at DESC);
CREATE INDEX idx_message_content
ON Message
USING GIN (to_tsvector('english', content));

CREATE TABLE Attachment (
    attachment_id UUID PRIMARY KEY,
    message_id UUID REFERENCES Message(message_id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT
);

CREATE TABLE Call (
    call_id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES Conversation(conversation_id) ON DELETE CASCADE,
    caller_id UUID REFERENCES Account(user_id) ON DELETE CASCADE,
    sender_id UUID REFERENCES Account(user_id) ON DELETE CASCADE,
    call_type VARCHAR(15) CHECK(call_type IN ('voice', 'video')),
    status VARCHAR(20) CHECK(status IN ('missed', 'completed', 'rejected')),
    start_time TIMESTAMP,
    end_time TIMESTAMP
);

CREATE TABLE Message_seen (
    id UUID PRIMARY KEY,
    message_id UUID REFERENCES Message(message_id) ON DELETE CASCADE,
    user_id UUID REFERENCES Account(user_id) ON DELETE CASCADE,
    seen_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE User_socket (
    user_id UUID REFERENCES Account(user_id),
    socket_id VARCHAR(100),
    PRIMARY KEY(user_id)
);