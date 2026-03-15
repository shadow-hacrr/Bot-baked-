const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { uploadImage } = require('../lib/uploadImage');

async function getQuotedOrOwnImageUrl(message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    const imageMessage = quoted?.imageMessage || message.message?.imageMessage;
    if (!imageMessage) return null;

    const stream = await downloadContentFromMessage(imageMessage, 'image');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    try {
        const uploadedUrl = await uploadImage(buffer);
        return uploadedUrl;
    } catch (e) {
        console.error('Image upload failed:', e.message);
        return null;
    }
}

async function reminiCommand(sock, chatId, message, args) {
    try {
        let imageUrl = null;

        if (args.length) {
            const url = args.join(' ');
            if (/^https?:\/\/.+\.(jpg|jpeg|png)$/i.test(url)) {
                imageUrl = url;
            } else {
                return await sock.sendMessage(chatId, { text: '❌ Invalid URL. Example: `.remini https://site.com/image.jpg`' }, { quoted: message });
            }
        } else {
            imageUrl = await getQuotedOrOwnImageUrl(message);
            if (!imageUrl) {
                return await sock.sendMessage(chatId, { 
                    text: '📸 Usage:\n• Reply to an image with `.remini`\n• `.remini <image_url>`'
                }, { quoted: message });
            }
        }

        const apiUrl = `https://api.princetechn.com/api/tools/remini?apikey=prince_tech_api_azfsbshfb&url=${encodeURIComponent(imageUrl)}`;
        const { data } = await axios.get(apiUrl, { timeout: 60000 });

        if (!data.success || !data.result?.image_url) {
            throw new Error(data.result?.message || 'Failed to enhance image');
        }

        const enhanced = await axios.get(data.result.image_url, { responseType: 'arraybuffer', timeout: 30000 });

        await sock.sendMessage(chatId, {
            image: enhanced.data,
            caption: '✨ *Image enhanced successfully!* 𝗘𝗡𝗛𝗔𝗡𝗖𝗘𝗗 𝗕𝗬 𝗦𝗛𝗔𝗗𝗢𝗪-𝗕𝗢𝗧'
        }, { quoted: message });

    } catch (error) {
        console.error('Remini Error:', error.message);
        let msg = '❌ Failed to enhance image.';
        if (error.response?.status === 429) msg = '⏰ Rate limit exceeded.';
        else if (error.response?.status === 400) msg = '❌ Invalid image URL.';
        else if (error.code === 'ECONNABORTED') msg = '⏰ Request timeout.';
        await sock.sendMessage(chatId, { text: msg }, { quoted: message });
    }
}

module.exports = { reminiCommand };