const { bots } = require('../lib/antilink');
const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

// Antilink command handler
async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```For Group Admins Only!```' }, { quoted: message });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `\`\`\`ANTILINK SETUP

${prefix}antilink on
${prefix}antilink set delete | kick | warn
${prefix}antilink off
${prefix}antilink get
\`\`\``;
            await sock.sendMessage(chatId, { text: usage }, { quoted: message });
            return;
        }

        switch (action) {

            case 'on':
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: '*_Antilink is already on_*' }, { quoted: message });
                    return;
                }

                const result = await setAntilink(chatId, 'on', 'delete');

                await sock.sendMessage(chatId, {
                    text: result ? '*_Antilink has been turned ON_*' : '*_Failed to turn on Antilink_*'
                }, { quoted: message });

                break;

            case 'off':
                await removeAntilink(chatId, 'on');

                await sock.sendMessage(chatId, {
                    text: '*_Antilink has been turned OFF_*'
                }, { quoted: message });

                break;

            case 'set':

                if (args.length < 2) {
                    await sock.sendMessage(chatId, {
                        text: `*_Please specify an action: ${prefix}antilink set delete | kick | warn_*`
                    }, { quoted: message });
                    return;
                }

                const setAction = args[1];

                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, {
                        text: '*_Invalid action. Choose delete, kick, or warn._*'
                    }, { quoted: message });
                    return;
                }

                const setResult = await setAntilink(chatId, 'on', setAction);

                await sock.sendMessage(chatId, {
                    text: setResult ? `*_Antilink action set to ${setAction}_*` : '*_Failed to set Antilink action_*'
                }, { quoted: message });

                break;

            case 'get':

                const status = await getAntilink(chatId, 'on');

                await sock.sendMessage(chatId, {
                    text: `*_Antilink Configuration:_*

Status: ${status?.enabled ? 'ON' : 'OFF'}
Action: ${status?.action || 'Not set'}`
                }, { quoted: message });

                break;

            default:

                await sock.sendMessage(chatId, {
                    text: `*_Use ${prefix}antilink for usage._*`
                });

        }

    } catch (error) {

        console.error('Error in antilink command:', error);

        await sock.sendMessage(chatId, {
            text: '*_Error processing antilink command_*'
        });

    }
}


// Extract text/caption/name from any message
function extractMessageText(message) {

    const msg = message.message || {};

    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    if (msg.documentMessage?.caption) return msg.documentMessage.caption;
    if (msg.audioMessage?.caption) return msg.audioMessage.caption;
    if (msg.stickerMessage?.caption) return msg.stickerMessage.caption;
    if (msg.pollCreationMessage?.name) return msg.pollCreationMessage.name;

    return '';

}


// Detect channel forwarded messages
function isChannelForwarded(msg) {

    const m = msg.message || {};

    if (
        m.extendedTextMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
        m.imageMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
        m.videoMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
        m.documentMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
        m.audioMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
        m.stickerMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
        m.pollCreationMessage?.contextInfo?.forwardedNewsletterMessageInfo
    ) return true;

    if (
        m.pollCreationMessage?.contextInfo?.forwardingScore > 0 ||
        m.pollCreationMessage?.contextInfo?.isForwarded
    ) return true;

    return false;

}


// Main link detection
async function handleLinkDetection(sock, chatId, message, senderId) {

    const antilinkConfig = await getAntilink(chatId, 'on');

    if (!antilinkConfig?.enabled) return;

    const action = antilinkConfig.action || 'delete';

    const userMessage = extractMessageText(message);

    const linkRegex = /https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i;

    const channelInviteRegex = /whatsapp\.com\/channel\/\S+|whatsapp\.com\/invite\/\S+/i;

    let shouldDelete = false;

    // Normal links
    if (userMessage && linkRegex.test(userMessage)) {
        shouldDelete = true;
    }

    // Channel invite links
    if (userMessage && channelInviteRegex.test(userMessage)) {
        shouldDelete = true;
    }

    // Channel forwarded messages / polls
    if (isChannelForwarded(message)) {
        shouldDelete = true;
    }

    if (!shouldDelete) return;

    const msgId = message.key.id;

    const participant = message.key.participant || senderId;

    try {

        await sock.sendMessage(chatId, {
            delete: {
                remoteJid: chatId,
                fromMe: false,
                id: msgId,
                participant: participant,
            },
        });

    } catch (err) {

        console.log('Delete error:', err);

    }

    if (action === 'kick') {

        await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');

    }

    if (action === 'warn') {

        await sock.sendMessage(chatId, {
            text: `⚠️ @${senderId.split('@')[0]} چینل لنک یا پول فارورڈ کرنا منع ہے!`,
            mentions: [senderId],
        });

    }

}


module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
};