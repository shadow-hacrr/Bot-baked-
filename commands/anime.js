const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ANIMU_BASE = 'https://api.some-random-api.com/animu';

// Normalize type
function normalizeType(input) {
    if (!input) return '';
    const lower = input.toLowerCase();
    if (lower === 'facepalm' || lower === 'face_palm') return 'face-palm';
    if (lower === 'quote' || lower === 'animu-quote' || lower === 'animuquote') return 'quote';
    return lower;
}

// Convert media (image or GIF) to sticker buffer
async function convertToSticker(buffer, isAnimated) {
    const tmpDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const inputExt = isAnimated ? 'gif' : 'jpg';
    const input = path.join(tmpDir, `animu_${Date.now()}.${inputExt}`);
    const output = path.join(tmpDir, `animu_${Date.now()}.webp`);
    fs.writeFileSync(input, buffer);

    const cmd = isAnimated
        ? `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=15" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 60 "${output}"`
        : `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 "${output}"`;

    await new Promise((resolve, reject) => exec(cmd, (err) => (err ? reject(err) : resolve())));
    const finalBuffer = fs.readFileSync(output);

    // Cleanup
    try { fs.unlinkSync(input); } catch {}
    try { fs.unlinkSync(output); } catch {}

    return finalBuffer;
}

// Send animu
async function sendAnimu(sock, chatId, message, type) {
    try {
        const res = await axios.get(`${ANIMU_BASE}/${type}`, { timeout: 15000 });
        const data = res.data;

        if (data.link) {
            const isGif = data.link.toLowerCase().endsWith('.gif');
            const isImg = ['.jpg', '.jpeg', '.png', '.webp'].some(ext => data.link.toLowerCase().endsWith(ext));
            if (isGif || isImg) {
                const resp = await axios.get(data.link, { responseType: 'arraybuffer' });
                const sticker = await convertToSticker(Buffer.from(resp.data), isGif);
                await sock.sendMessage(chatId, { sticker }, { quoted: message });
                return;
            }
            // fallback
            await sock.sendMessage(chatId, { image: { url: data.link }, caption: `anime: ${type}` }, { quoted: message });
            return;
        }

        if (data.quote) {
            await sock.sendMessage(chatId, { text: data.quote }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, { text: '❌ Failed to fetch animu.' }, { quoted: message });
    } catch (err) {
        console.error('Anime command error:', err);
        await sock.sendMessage(chatId, { text: '❌ Error fetching animu.' }, { quoted: message });
    }
}

// Main command
async function animeCommand(sock, chatId, message, args) {
    const type = normalizeType(args[0]);
    const supported = ['nom', 'poke', 'cry', 'kiss', 'pat', 'hug', 'wink', 'face-palm', 'quote'];

    if (!type) {
        await sock.sendMessage(chatId, { text: `Usage: .animu <type>\nTypes: ${supported.join(', ')}` }, { quoted: message });
        return;
    }

    if (!supported.includes(type)) {
        await sock.sendMessage(chatId, { text: `❌ Unsupported type: ${type}. Use one of: ${supported.join(', ')}` }, { quoted: message });
        return;
    }

    await sendAnimu(sock, chatId, message, type);
}

module.exports = { animeCommand };