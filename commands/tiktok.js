const { ttdl } = require("ruhend-scraper");
const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    try {
        // Prevent duplicate processing
        if (processedMessages.has(message.key.id)) return;
        processedMessages.add(message.key.id);
        setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000); // 5 mins

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) return await sock.sendMessage(chatId, { text: "Please provide a TikTok link." });

        // Extract URL from command
        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url) return await sock.sendMessage(chatId, { text: "Please provide a TikTok link." });

        // Validate TikTok URL
        const tiktokPatterns = [
            /https?:\/\/(?:www\.)?tiktok\.com\//,
            /https?:\/\/(?:vm\.)?tiktok\.com\//,
            /https?:\/\/(?:vt\.)?tiktok\.com\//,
        ];
        if (!tiktokPatterns.some(p => p.test(url))) {
            return await sock.sendMessage(chatId, { text: "Invalid TikTok link. Please provide a valid video link." });
        }

        // React 🔄 to show processing
        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

        let videoUrl = null;
        let title = null;

        // 1️⃣ Siputzx API
        try {
            const response = await axios.get(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 15000
            });

            if (response.data?.status && response.data.data) {
                videoUrl = response.data.data.urls?.[0] || response.data.data.video_url || response.data.data.download_url;
                title = response.data.data.metadata?.title || "TikTok Video";
            }

            if (!videoUrl) throw new Error("No video URL from API");
        } catch (err) {
            console.error("Siputzx API error:", err.message);
        }

        // 2️⃣ Send video from URL if available
        if (videoUrl) {
            try {
                await sock.sendMessage(chatId, {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption: `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗦𝗛𝗔𝗗𝗢𝗪-𝗕𝗢𝗧\n📝 Title: ${title}`
                }, { quoted: message });
                return;
            } catch (err) {
                console.error("Failed to send video from URL:", err.message);
            }
        }

        // 3️⃣ Fallback ttdl
        try {
            const ttdlData = await ttdl(url);
            if (ttdlData?.data?.length) {
                const media = ttdlData.data.find(m => m.type === "video");
                if (media) {
                    await sock.sendMessage(chatId, {
                        video: { url: media.url },
                        mimetype: "video/mp4",
                        caption: `𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗦𝗛𝗔𝗗𝗢𝗪-𝗕𝗢𝗧`
                    }, { quoted: message });
                    return;
                }
            }
        } catch (err) {
            console.error("ttdl fallback failed:", err.message);
        }

        // 4️⃣ If all fail
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to download TikTok video. Please try again with a different link."
        }, { quoted: message });

    } catch (error) {
        console.error("TikTok command error:", error);
        await sock.sendMessage(chatId, { 
            text: "An unexpected error occurred while processing your request."
        }, { quoted: message });
    }
}

module.exports = tiktokCommand;