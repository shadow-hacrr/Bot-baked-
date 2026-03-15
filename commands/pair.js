const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const path = require('path');

async function pairCommand(sock, chatId, message, q) {
    try {
        if (!q) {
            return sock.sendMessage(chatId, {
                text: "Example:\n.pair 923001234567"
            }, { quoted: message });
        }

        const number = q.replace(/[^0-9]/g, '');

        if (!number.startsWith('92') || number.length !== 12) {
            return sock.sendMessage(chatId, {
                text: "❌ Use Pakistan format:\n923XXXXXXXXX"
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: "⏳ Generating OTP for WhatsApp pairing..."
        }, { quoted: message });

        // Create session folder for this user
        const sessionPath = path.join(__dirname, `../sessions/${number}`);
        if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

        // Initialize multi-file auth
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        const pairingSock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false
        });

        pairingSock.ev.on('creds.update', saveCreds);

        // Request OTP from WhatsApp official servers
        const otpData = await pairingSock.requestPairingCode(number);

        // Send OTP to user in chat
        await sock.sendMessage(chatId, {
            text: `✅ Your OTP:\n${otpData}\n\n⚠️ This OTP will expire in 1 minute!`,
            quoted: message
        });

        // Setup expiry after 1 minute
        setTimeout(() => {
            pairingSock.logout().catch(() => {});
        }, 60_000); // 60 seconds

        // Listen for successful connection
        pairingSock.ev.on('connection.update', async (update) => {
            if (update.connection === 'open') {
                await sock.sendMessage(chatId, {
                    text: "🎉 Successfully Connected! You can now use all bot features with this number.",
                    quoted: message
                });
            }
        });

    } catch (err) {
        console.log("PAIR ERROR:", err);
        await sock.sendMessage(chatId, {
            text: "❌ Failed to generate OTP. Make sure you are using latest Baileys and correct number.",
            quoted: message
        });
    }
}

module.exports = pairCommand;