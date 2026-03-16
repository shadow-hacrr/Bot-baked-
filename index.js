/**
 * SHADOW Bot - WhatsApp Bot (Fixed for Web Pairing)
 */
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const express = require("express")
const cors = require("cors")
const { rmSync } = require('fs')
const store = require('./lib/lightweight_store')
store.readFromFile()
const settings = require('./settings')

// -------------------
// Express API Setup
// -------------------
const app = express()
app.use(cors())
app.use(express.json())
const PORT = process.env.PORT || 3000

setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)
setInterval(() => { if(global.gc) global.gc() }, 60_000)
setInterval(() => { const used = process.memoryUsage().rss / 1024 / 1024; if(used > 400) process.exit(1) }, 30_000)

let XeonBotInc = null

// -------------------
// Web API for Pairing
// -------------------
app.post('/pair', async (req, res) => {
    const { number } = req.body
    if (!number) return res.status(400).send({ error: 'Phone number required' })
    if (!XeonBotInc) return res.status(500).send({ error: 'Bot not ready yet' })
    try {
        let code = await XeonBotInc.requestPairingCode(number)
        code = code?.match(/.{1,4}/g)?.join("-") || code
        return res.send({ pairingCode: code })
    } catch (err) {
        return res.status(500).send({ error: err.message })
    }
})

app.listen(PORT, () => console.log(chalk.green(`✅ Web API running on port ${PORT}`)))

// -------------------
// Start Bot
// -------------------
async function startXeonBotInc() {
    try {
        let { version } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

        XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false, // Terminal QR disabled
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => store.loadMessage(key.remoteJid, key.id)?.message || "",
            msgRetryCounterCache
        })

        XeonBotInc.ev.on('creds.update', saveCreds)
        store.bind(XeonBotInc.ev)

        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            const mek = chatUpdate.messages[0]
            if(!mek?.message) return
            mek.message = (Object.keys(mek.message)[0]==='ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            await handleMessages(XeonBotInc, chatUpdate, true)
        })

        XeonBotInc.ev.on('group-participants.update', async update => await handleGroupParticipantUpdate(XeonBotInc, update))
        XeonBotInc.ev.on('status.update', async status => await handleStatus(XeonBotInc, status))
        XeonBotInc.ev.on('messages.reaction', async status => await handleStatus(XeonBotInc, status))

        console.log(chalk.green(`🤖 Bot started successfully! Web pairing ready.`))

    } catch (error) {
        console.error('Error in startXeonBotInc:', error)
        setTimeout(startXeonBotInc, 5000)
    }
}

startXeonBotInc().catch(err => console.error('Fatal Error:', err))
process.on('uncaughtException', err => console.error('Uncaught Exception:', err))
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err))
