const axios = require('axios');

async function aiCommand(sock, chatId, message) {
    try {
        // Get user text
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a question after .gpt or .gemini\nExample: .gpt write a basic html code"
            }, { quoted: message });
        }

        // Split command and query
        const parts = text.trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a question after .gpt or .gemini"
            }, { quoted: message });
        }

        // Inform user bot is processing
        await sock.sendMessage(chatId, { text: "🤖 Processing your request..." }, { quoted: message });

        if (command === '.gpt') {
            // GPT API
            const response = await axios.get(`https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(query)}`);
            const answer = response.data?.result;
            if (answer) {
                await sock.sendMessage(chatId, { text: answer }, { quoted: message });
            } else {
                throw new Error("No response from GPT API");
            }
        } else if (command === '.gemini') {
            const apis = [
                `https://vapis.my.id/api/gemini?q=${encodeURIComponent(query)}`,
                `https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodeURIComponent(query)}`,
                `https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(query)}`,
                `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(query)}`,
                `https://api.giftedtech.my.id/api/ai/geminiai?apikey=gifted&q=${encodeURIComponent(query)}`,
                `https://api.giftedtech.my.id/api/ai/geminiaipro?apikey=gifted&q=${encodeURIComponent(query)}`
            ];

            let answered = false;
            for (const api of apis) {
                try {
                    const res = await axios.get(api);
                    const data = res.data;
                    const answer = data?.message || data?.data || data?.answer || data?.result;
                    if (answer) {
                        await sock.sendMessage(chatId, { text: answer }, { quoted: message });
                        answered = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!answered) {
                await sock.sendMessage(chatId, { text: "❌ Failed to get response from all Gemini APIs." }, { quoted: message });
            }
        }
    } catch (err) {
        console.error('AI Command Error:', err);
        await sock.sendMessage(chatId, { text: "❌ An error occurred. Please try again later." }, { quoted: message });
    }
}

module.exports = aiCommand;