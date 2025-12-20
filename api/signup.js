export default async function handler(req, res) {
    const { name, email, company, message } = req.body;

    // 1. Google Form Config (Extracted from your link)
    const FORM_ID = '1FAIpQLScQQhkDqiSSsq7R3jdKaroPv3yjtNrgHmHv7g_XhIZo81YDUQ';
    const GOOGLE_URL = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;

    try {
        // 2. Send data to Google Forms
        await fetch(GOOGLE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'entry.1782966477': name,    // Name
                'entry.1816007361': email,   // Email
                'entry.1997805328': company, // Company
                // Note: Message ID was missing from your link. 
                // To save messages, add the 4th ID here later.
            })
        });

        // 3. Log to Vercel (Backup)
        console.log(`✅ Saved to Google Sheet: ${name} / ${email}`);
        
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Google Sheet Error:', error);
        res.status(500).json({ error: 'Failed to save' });
    }
}