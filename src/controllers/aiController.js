const ai = require("../services/aiService");
const pool = require("../config/db");

exports.summarizeUnreadMessages = async (req, res) => {
    try {

        const { conversationId } = req.body;

        const result = await pool.query(
            `
            SELECT
                u.full_name,
                m.message_text
            FROM Messages m
            JOIN Users u
                ON u.user_id = m.sender_id
            WHERE m.conversation_id = $1
            AND m.message_type = 'text'
            ORDER BY m.created_at DESC
            LIMIT 50
            `,
            [conversationId]
        );

        const messages = result.rows
            .reverse()
            .map(
                item =>
                    `${item.full_name}: ${item.message_text}`
            )
            .join("\n");

        const prompt = `
Bạn là trợ lý AI cho ứng dụng chat.

Nhiệm vụ:

1. Tóm tắt cuộc trò chuyện.
2. Liệt kê công việc cần làm.
3. Liệt kê deadline nếu có.

Tin nhắn:

${messages}

Trả lời bằng tiếng Việt.
`;

        const response =
            await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
            });

        return res.json({
            summary: response.text,
        });

    } catch (err) {
        console.log(err);

        return res.status(500).json({
            message: err.message,
        });
    }
};