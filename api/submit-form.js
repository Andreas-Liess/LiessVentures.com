export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { thought, name, email } = req.body;

    // Validate required fields
    if (!thought || !name || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Google Form Configuration
    const FORM_ID = '1FAIpQLSdgKXT6HC4BFfc2NFUb_2uoD9ttko4eoAoOG3O8d9Vh2yDoyw';
    const GOOGLE_URL = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;

    try {
        // Send data to Google Forms
        await fetch(GOOGLE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'entry.1495536293': thought,  // What is your thought?
                'entry.192007185': name,       // What is your Name?
                'entry.1316279483': email,     // What is your e-mail?
            })
        });

        // Log to Vercel (for debugging)
        console.log(`✅ Form submitted: ${name} / ${email}`);

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Google Form submission error:', error);
        res.status(500).json({ error: 'Failed to submit form' });
    }
}
