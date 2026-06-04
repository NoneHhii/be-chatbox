const axios = require("axios");

const sendOTPEmail = async (userEmail, otpCode) => {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "chatbox",
          email: "thienkhoatgddqng@gmail.com",
        },
        to: [
          {
            email: userEmail,
          },
        ],
        subject: "Mã OTP xác thực",
        htmlContent: `
          <h2>Xác thực tài khoản</h2>
          <h1>${otpCode}</h1>
          <p>Mã có hiệu lực trong 5 phút.</p>
        `,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Email sent:", response.data);

    return { success: true };
  } catch (error) {
    console.error(
      "Brevo Error:",
      error.response?.data || error.message
    );

    return { success: false, error };
  }
};

module.exports = { sendOTPEmail };