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
let botReady = false
let pendingPairingCode = null
let pairingCodeGenerated = false

// -------------------
// Web API for Pairing
// -------------------
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>SHADOW Bot</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>🤖 SHADOW Bot is Running!</h1>
                <p>Bot Status: ${botReady ? '✅ Connected' : '⏳ Connecting...'}</p>
                <p>Pairing Code: ${pendingPairingCode ? pendingPairingCode : '❌ Not generated yet'}</p>
                <form action="/generate-pair" method="POST">
                    <input type="text" name="number" placeholder="Enter phone number (e.g., 919876543210)" required>
                    <button type="submit">Generate Pairing Code</button>
                </form>
                ${pendingPairingCode ? `
                    <div style="margin-top: 20px; padding: 20px; background: #f0f0f0; border-radius: 10px;">
                        <h2>Your Pairing Code:</h2>
                        <h1 style="font-size: 48px; letter-spacing: 5px;">${pendingPairingCode}</h1>
                        <p>Open WhatsApp on your phone → Linked Devices → Link a Device</p>
                    </div>
                ` : ''}
            </body>
        </html>
    `)
})

app.post('/generate-pair', async (req, res) => {
    const { number } = req.body
    if (!number) {
        return res.status(400).send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1 style="color: red;">❌ Error</h1>
                    <p>Phone number is required!</p>
                    <a href="/">Go Back</a>
                </body>
            </html>
        `)
    }
    
    try {
        if (!XeonBotInc) {
            return res.status(500).send(`
                <html>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1 style="color: red;">❌ Error</h1>
                        <p>Bot is not ready yet. Please wait...</p>
                        <a href="/">Refresh</a>
                    </body>
                </html>
            `)
        }
        
        // Format number (remove + and spaces)
        const formattedNumber = number.replace(/[^0-9]/g, '')
        
        // Generate pairing code
        let code = await XeonBotInc.requestPairingCode(formattedNumber)
        
        // Format code with dashes (XXXX-XXXX-XXXX-XXXX)
        if (code) {
            code = code.match(/.{1,4}/g)?.join("-") || code
            pendingPairingCode = code
            pairingCodeGenerated = true
            
            // Also log to console
            console.log(chalk.green(`✅ Pairing Code for ${formattedNumber}: ${code}`))
            
            // Try to send via Telegram if configured
            try {
                if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
                    const fetch = require('node-fetch')
                    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: process.env.TELEGRAM_CHAT_ID,
                            text: `🔐 *WhatsApp Pairing Code*\n\nNumber: ${formattedNumber}\nCode: \`${code}\`\n\nOpen WhatsApp → Linked Devices → Link a Device`
                        })
                    })
                }
            } catch (telegramErr) {
                console.log('Telegram notification failed:', telegramErr.message)
            }
        }
        
        res.send(`
            <html>
                <head>
                    <style>
                        body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
                        .container { background: rgba(255,255,255,0.1); border-radius: 20px; padding: 30px; backdrop-filter: blur(10px); }
                        .code { font-size: 48px; font-weight: bold; letter-spacing: 10px; background: rgba(0,0,0,0.3); padding: 20px; border-radius: 10px; margin: 20px 0; }
                        .steps { text-align: left; background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; }
                        button { background: #4CAF50; color: white; border: none; padding: 15px 30px; font-size: 18px; border-radius: 5px; cursor: pointer; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>✅ Pairing Code Generated!</h1>
                        <div class="code">${code}</div>
                        <div class="steps">
                            <h3>📱 Steps to Connect:</h3>
                            <ol>
                                <li>Open WhatsApp on your phone</li>
                                <li>Tap Menu (3 dots) or Settings</li>
                                <li>Go to Linked Devices</li>
                                <li>Tap "Link a Device"</li>
                                <li>Enter this code: <strong>${code}</strong></li>
                            </ol>
                        </div>
                        <p>Code also sent to console and Telegram (if configured)</p>
                        <button onclick="window.location.href='/'">⬅️ Back to Home</button>
                    </div>
                </body>
            </html>
        `)
        
    } catch (err) {
        console.error('Pairing error:', err)
        res.status(500).send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1 style="color: red;">❌ Error</h1>
                    <p>${err.message}</p>
                    <a href="/">Go Back</a>
                </body>
            </html>
        `)
    }
})

// API endpoint for JSON response
app.post('/pair', async (req, res) => {
    const { number } = req.body
    if (!number) return res.status(400).json({ error: 'Phone number required' })
    
    try {
        if (!XeonBotInc) {
            return res.status(500).json({ error: 'Bot not ready yet' })
        }
        
        const formattedNumber = number.replace(/[^0-9]/g, '')
        let code = await XeonBotInc.requestPairingCode(formattedNumber)
        code = code?.match(/.{1,4}/g)?.join("-") || code
        pendingPairingCode = code
        
        return res.json({ 
            success: true, 
            pairingCode: code,
            message: 'Use this code in WhatsApp Linked Devices'
        })
    } catch (err) {
        return res.status(500).json({ error: err.message })
    }
})

app.get('/status', (req, res) => {
    res.json({
        botStatus: botReady ? 'connected' : 'connecting',
        pairingCodeGenerated: pairingCodeGenerated,
        pendingPairingCode: pendingPairingCode || null
    })
})

app.listen(PORT, () => {
    console.log(chalk.green(`✅ Web API running on http://localhost:${PORT}`))
    console.log(chalk.blue(`🌐 Public URL: ${process.env.REALWAY_URL || 'Not set'}`))
})

// -------------------
// Start Bot
// -------------------
async function startXeonBotInc() {
    try {
        console.log(chalk.yellow('🚀 Starting SHADOW Bot...'))
        
        let { version } = await fetchLatestBaileysVersion()
        console.log(chalk.blue(`📱 Using Baileys version: ${version}`))
        
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

        XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
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

        // Handle connection updates
        XeonBotInc.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update
            
            if (qr) {
                console.log('QR Code received (but we are using pairing code)')
            }
            
            if (connection === 'open') {
                botReady = true
                console.log(chalk.green('✅ Bot connected to WhatsApp!'))
                console.log(chalk.cyan(`👤 Logged in as: ${XeonBotInc.user?.name || 'Unknown'} (${XeonBotInc.user?.id})`))
                
                // Send startup notification if Telegram configured
                if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
                    try {
                        const fetch = require('node-fetch')
                        fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: process.env.TELEGRAM_CHAT_ID,
                                text: `✅ *SHADOW Bot Started*\n\nUser: ${XeonBotInc.user?.name}\nNumber: ${XeonBotInc.user?.id.split(':')[0]}`
                            })
                        }).catch(e => {})
                    } catch (e) {}
                }
            }
            
            if (connection === 'close') {
                botReady = false
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const shouldReconnect = statusCode !== 401 // Don't reconnect if logged out
                
                console.log(chalk.red('❌ Connection closed'), lastDisconnect?.error)
                
                if (shouldReconnect) {
                    console.log(chalk.yellow('🔄 Reconnecting in 5 seconds...'))
                    setTimeout(startXeonBotInc, 5000)
                } else {
                    console.log(chalk.red('🚫 Logged out. Delete session folder and restart.'))
                }
            }
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

        console.log(chalk.green(`🤖 Bot initialized! Web pairing ready at /generate-pair`))

    } catch (error) {
        console.error('Error in startXeonBotInc:', error)
        setTimeout(startXeonBotInc, 5000)
    }
}

// Start the bot
startXeonBotInc().catch(err => console.error('Fatal Error:', err))

process.on('uncaughtException', err => {
    console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err)
})
