const { isJidGroup } = require('@whiskeysockets/baileys');
const { getAntilink, incrementWarningCount, resetWarningCount, isSudo } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const config = require('../config');

const WARN_COUNT = config.WARN_COUNT || 3;


// Detect any normal URL
function containsURL(str) {
	return /(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?/i.test(str);
}


// Detect WhatsApp Channel Invite links
function containsChannelInvite(str) {
	return /(whatsapp\.com\/channel\/|whatsapp\.com\/invite\/)/i.test(str);
}


// Extract text/caption/name from any type of message
function extractMessageText(msg) {

	const m = msg.message || {};

	if (m.conversation) return m.conversation;
	if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
	if (m.imageMessage?.caption) return m.imageMessage.caption;
	if (m.videoMessage?.caption) return m.videoMessage.caption;
	if (m.documentMessage?.caption) return m.documentMessage.caption;
	if (m.audioMessage?.caption) return m.audioMessage.caption;
	if (m.stickerMessage?.caption) return m.stickerMessage.caption;
	if (m.pollCreationMessage?.name) return m.pollCreationMessage.name;

	return '';
}


// Detect channel forwarded / channel poll / channel admin invite
function isChannelForwarded(msg) {

	const m = msg.message || {};

	return !!(

		// Channel forwarded messages
		m.extendedTextMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
		m.imageMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
		m.videoMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
		m.documentMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
		m.audioMessage?.contextInfo?.forwardedNewsletterMessageInfo ||
		m.stickerMessage?.contextInfo?.forwardedNewsletterMessageInfo ||

		// Channel polls
		m.pollCreationMessage?.contextInfo?.forwardedNewsletterMessageInfo ||

		// Some channel poll formats
		m.pollCreationMessage?.contextInfo?.forwardingScore > 0 ||

		// Admin invite or newsletter mention
		m.extendedTextMessage?.contextInfo?.newsletterJid ||
		m.imageMessage?.contextInfo?.newsletterJid ||
		m.videoMessage?.contextInfo?.newsletterJid ||
		m.documentMessage?.contextInfo?.newsletterJid

	);
}


async function Antilink(msg, sock) {

	const jid = msg.key.remoteJid;

	if (!isJidGroup(jid)) return;

	const sender = msg.key.participant;

	if (!sender) return;

	const messageText = extractMessageText(msg);


	// Skip admin or sudo
	try {

		const { isSenderAdmin } = await isAdmin(sock, jid, sender);

		if (isSenderAdmin) return;

	} catch (_) {}

	if (await isSudo(sender)) return;


	const hasLink = messageText && containsURL(messageText.trim());
	const channelInvite = messageText && containsChannelInvite(messageText.trim());
	const channelForwarded = isChannelForwarded(msg);


	// Ignore normal messages, trigger only if link / channel invite / channel forwarded
	if (!hasLink && !channelInvite && !channelForwarded) return;


	const antilinkConfig = await getAntilink(jid, 'on');

	if (!antilinkConfig?.enabled) return;

	const action = antilinkConfig.action || 'delete';


	try {

		// Delete message
		await sock.sendMessage(jid, { delete: msg.key });


		switch (action) {

			case 'delete':

				await sock.sendMessage(jid, {

					text: `\`\`\`@${sender.split('@')[0]} link or channel messages are not allowed\`\`\``,

					mentions: [sender],

				});

				break;


			case 'kick':

				await sock.groupParticipantsUpdate(jid, [sender], 'remove');

				await sock.sendMessage(jid, {

					text: `\`\`\`@${sender.split('@')[0]} has been kicked for sending link/channel message\`\`\``,

					mentions: [sender],

				});

				break;


			case 'warn':

				const warningCount = await incrementWarningCount(jid, sender);

				if (warningCount >= WARN_COUNT) {

					await sock.groupParticipantsUpdate(jid, [sender], 'remove');

					await resetWarningCount(jid, sender);

					await sock.sendMessage(jid, {

						text: `\`\`\`@${sender.split('@')[0]} has been kicked after ${WARN_COUNT} warnings\`\`\``,

						mentions: [sender],

					});

				} else {

					await sock.sendMessage(jid, {

						text: `\`\`\`@${sender.split('@')[0]} warning ${warningCount}/${WARN_COUNT} for sending link/channel message\`\`\``,

						mentions: [sender],

					});

				}

				break;

		}

	} catch (error) {

		console.error('Error in Antilink:', error);

	}

}

module.exports = { Antilink };