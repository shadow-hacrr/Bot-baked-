const convertStickerToImage = async (sock, quotedMessage, chatId) => {
    await sock.sendMessage(chatId, { text: 'This command is disabled because sharp is not installed.' });
};

module.exports = convertStickerToImage;