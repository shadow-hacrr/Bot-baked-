const fs = require('fs');
const path = require('path');

// 200 emojis array (sample, آپ مزید add کر سکتے ہیں)
const commandEmojis = [
"😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋",
"😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖",
"😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔",
"🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴",
"🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖",
"🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾","👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞",
"🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝",
"🙏","✍️","💅","🤳","💪","🦾","🦵","🦿","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅",
"👄","💋","🩸","💘","💝","💖","💗","💓","💕","💞","❣️","💔","❤️","🧡","💛","💚","💙","💜","🤎","🖤",
"🤍","💌","💤","💢","💥","💦","💨","🕳️","💣","💬","👁️‍🗨️","🗨️","🗯️","💭","💤","🪐","🌍","🌎","🌏",
"🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌚","🌝","🌛","🌜","🌞","⭐","🌟","✨","⚡","🔥","💥","☄️",
"💫","🌪️","🌈","☀️","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄","🌬️","💨","💧",
"💦","☔","☂️","🌊","🌫️","🌀","🌁","🌂","🧊","🎃","🎄","🎆","🎇","🧨","✨","🎈","🎉","🎊","🎋","🎍",
"🎎","🎏","🎐","🎑","🧧","🎀","🎁","🎗️","🎟️","🎫","🎖️","🏆","🏅","🥇","🥈","🥉","⚽","⚾","🥎","🏀",
"🏐","🏈","🏉","🎾","🥏","🎳","🏏","🏑","🏒","🥍","🏓","🏸","🥊","🥋","🥅","⛳","🏹","🎣","🤿","🥌",
"🎿","⛷️","🏂","🏋️‍♂️","🏋️‍♀️","🤼‍♂️","🤼‍♀️","🤸‍♂️","🤸‍♀️","⛹️‍♂️","⛹️‍♀️","🤺","🤾‍♂️","🤾‍♀️",
"🏌️‍♂️","🏌️‍♀️","🏇","🧘‍♂️","🧘‍♀️","🏄‍♂️","🏄‍♀️","🏊‍♂️","🏊‍♀️","🤽‍♂️","🤽‍♀️","🚣‍♂️","🚣‍♀️",
"🧗‍♂️","🧗‍♀️","🚵‍♂️","🚵‍♀️","🚴‍♂️","🚴‍♀️","🏆","🏅","🥇","🥈","🥉","🏵️","🎖️","🏷️","💰","💴",
"💵","💶","💷","💸","💳","🧾","💹","💱","💲","✏️","🖊️","🖋️","🖌️","🖍️","📝","📁","📂","📅","📆","📇",
"📈","📉","📊","📋","📌","📍","📎","🖇️","📏","📐","✂️","🗃️","🗄️","🗑️","🔒","🔓","🔏","🔐","🔑","🗝️",
"🔨","🪓","⛏️","⚒️","🛠️","🗡️","⚔️","🔫","🪃","🏹","🛡️","🪚","🔧","🪛","🔩","⚙️","🗜️","⚖️","🦯",
"🔗","⛓️","🪝","🧰","🧲","🪜","⚗️","🧪","🧫","🧬","🔬","🔭","📡","💉","💊","🩺","🚪","🛗","🪞",
"🪟","🛏️","🛋️","🪑","🚽","🚿","🛁","🪤","🪒","🧴","🧷","🧹","🧺","🧻","🪣","🧼","🪥","🧽","🪠",
"🧯","🛒","🚬","⚰️","🪦","⚱️","🗿","🪧","🏧","🚮","🚰","♿","🚹","🚺","🚻","🚼","🚾","🛂","🛃",
"🛄","🛅","⚠️","🚸","⛔","🚫","🚳","🚭","🚯","🚱","🚷","📵","🚳","🚷","🔞","☢️","☣️","⬆️","↗️","➡️",
"↘️","⬇️","↙️","⬅️","↖️","↕️","↔️","↩️","↪️","⤴️","⤵️","🔃","🔄","🔙","🔚","🔛","🔜","🔝","🛐",
"⚛️","🕉️","✡️","☸️","☯️","✝️","☦️","☪️","☮️","🕎","🔯","☯️","✡️","☸️","☮️","🛑","⛔","🚫",
"💯","✅","✔️","✖️","❌","⭕","🔴","🔵","⚪","⚫","🔺","🔻","🔸","🔹","🔶","🔷","🔳","🔲"
];


// Path for storing auto-reaction state
const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// Load auto-reaction state from file
function loadAutoReactionState() {
    try {
        if (fs.existsSync(USER_GROUP_DATA)) {
            const data = JSON.parse(fs.readFileSync(USER_GROUP_DATA));
            return data.autoReaction || false;
        }
    } catch (error) {
        console.error('Error loading auto-reaction state:', error);
    }
    return false;
}

// Save auto-reaction state to file
function saveAutoReactionState(state) {
    try {
        const data = fs.existsSync(USER_GROUP_DATA) 
            ? JSON.parse(fs.readFileSync(USER_GROUP_DATA))
            : { groups: [], chatbot: {} };
        
        data.autoReaction = state;
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving auto-reaction state:', error);
    }
}

// Global state
let isAutoReactionEnabled = loadAutoReactionState();

// Get random emoji
function getRandomEmoji() {
    const index = Math.floor(Math.random() * commandEmojis.length);
    return commandEmojis[index];
}

// Add reaction to any message
async function addCommandReaction(sock, message) {
    try {
        if (!isAutoReactionEnabled || !message?.key?.id) return;

        const emoji = getRandomEmoji();
        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (error) {
        console.error('Error adding reaction:', error);
    }
}

// Handle .areact command (owner only)
async function handleAreactCommand(sock, chatId, message, isOwner) {
    try {
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command is only available for the owner!',
                quoted: message
            });
            return;
        }

        const args = message.message?.conversation?.split(' ') || [];
        const action = args[1]?.toLowerCase();

        if (action === 'on') {
            isAutoReactionEnabled = true;
            saveAutoReactionState(true);
            await sock.sendMessage(chatId, { 
                text: '✅ Auto-reactions have been enabled globally',
                quoted: message
            });
        } else if (action === 'off') {
            isAutoReactionEnabled = false;
            saveAutoReactionState(false);
            await sock.sendMessage(chatId, { 
                text: '✅ Auto-reactions have been disabled globally',
                quoted: message
            });
        } else {
            const currentState = isAutoReactionEnabled ? 'enabled' : 'disabled';
            await sock.sendMessage(chatId, { 
                text: `Auto-reactions are currently ${currentState} globally.\n\nUse:\n.areact on - Enable auto-reactions\n.areact off - Disable auto-reactions`,
                quoted: message
            });
        }
    } catch (error) {
        console.error('Error handling areact command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error controlling auto-reactions',
            quoted: message
        });
    }
}

module.exports = {
    addCommandReaction,
    handleAreactCommand
};