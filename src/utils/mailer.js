const Brevo = require("@getbrevo/brevo");

const apiInstance = new Brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

const sendOTPEmail = async (userEmail, otpCode) => {
  try {
    const email = {
      sender: {
        name: "ChatBox",
        email: "youraccount@gmail.com",
      },
      to: [
        {
          email: userEmail,
        },
      ],
      subject: "Mã OTP xác thực",
      htmlContent: `
        <h2>Xác thực tài khoản</h2>
        <p>Mã OTP của bạn là:</p>
        <h1>${otpCode}</h1>
        <p>Mã có hiệu lực trong 5 phút.</p>
      `,
    };

    const result = await apiInstance.sendTransacEmail(email);

    console.log("Email sent:", result);

    return { success: true };
  } catch (error) {
    console.error("Brevo Error:", error);

    return {
      success: false,
      error,
    };
  }
};

module.exports = { sendOTPEmail };