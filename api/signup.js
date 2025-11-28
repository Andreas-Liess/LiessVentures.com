// File: api/signup.js
export default async function handler(req, res) {
    // 1. Get the data
    const { name, email, company, message } = req.body;

    // 2. Format the data for logs ("beautifully")
    const formattedLog = `
    =========================================
    🚀 NEW SIGNUP RECEIVED (Vercel Log)
    =========================================
    👤 Name:    ${name}
    📧 Email:   ${email}
    Pb Company: ${company || 'N/A'}
    💬 Message: ${message || 'N/A'}
    =========================================
    `;

    // 3. Log it (Visible in Vercel Dashboard -> Logs)
    console.log(formattedLog);

    // 4. Respond to frontend
    res.status(200).json({ success: true });
}