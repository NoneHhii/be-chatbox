INSERT INTO Account (user_id, username, email, phone, password)
VALUES
(uuid_generate_v4(), 'khoa', 'khoa@gmail.com', '0900000001', '123456'),
(uuid_generate_v4(), 'an', 'an@gmail.com', '0900000002', '123456'),
(uuid_generate_v4(), 'binh', 'binh@gmail.com', '0900000003', '123456'),
(uuid_generate_v4(), 'cuong', 'cuong@gmail.com', '0900000004', '123456'),
(uuid_generate_v4(), 'duy', 'duy@gmail.com', '0900000005', '123456'),
(uuid_generate_v4(), 'giang', 'giang@gmail.com', '0900000006', '123456'),
(uuid_generate_v4(), 'hung', 'hung@gmail.com', '0900000007', '123456'),
(uuid_generate_v4(), 'khanh', 'khanh@gmail.com', '0900000008', '123456'),
(uuid_generate_v4(), 'linh', 'linh@gmail.com', '0900000009', '123456'),
(uuid_generate_v4(), 'minh', 'minh@gmail.com', '0900000010', '123456'),
(uuid_generate_v4(), 'nam', 'nam@gmail.com', '0900000011', '123456'),
(uuid_generate_v4(), 'phuong', 'phuong@gmail.com', '0900000012', '123456');

INSERT INTO Conversation (conversation_id, name, type, create_by)
SELECT uuid_generate_v4(), 'Group Chat Demo', 'group', user_id
FROM Account
LIMIT 1;

INSERT INTO Conversation_member (id, conversation_id, user_id, role)
SELECT 
    uuid_generate_v4(),
    c.conversation_id,
    a.user_id,
    'member'
FROM Conversation c
CROSS JOIN Account a
LIMIT 5;

INSERT INTO Message (message_id, conversation_id, sender_id, content, message_type)
SELECT
    uuid_generate_v4(),
    c.conversation_id,
    a.user_id,
    'Hello this is a test message',
    'text'
FROM Conversation c
JOIN Account a ON TRUE
LIMIT 20;