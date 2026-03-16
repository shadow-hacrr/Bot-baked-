/**
 * SHADOW Bot - WhatsApp Bot (Fixed Form Submission)
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
// Express API Setup - FIXED
// -------------------
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true })) // 👈 IMPORTANT: This parses form data
app.use(express.static('public')) // Optional: for static files

const PORT = process.env.PORT || 3000

// ... rest of your intervals
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)
setInterval(() => { if(global.gc) global.gc() }, 60_000)
setInterval(() => { const used = process.memoryUsage().rss / 1024 / 1024; if(used > 400) process.exit(1) }, 30_000)

let XeonBotInc = null
let botReady = false
let pendingPairingCode = null
let pairingCodeGenerated = false

// -------------------
// Web API for Pairing - FIXED FORM HANDLING
// -------------------
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>SHADOW Bot</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 20px; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        margin: 0;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    .container {
                        background: white;
                        padding: 30px;
                        border-radius: 20px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        max-width: 500px;
                        width: 90%;
                    }
                    h1 { color: #333; margin-bottom: 20px; }
                    .status {
                        padding: 10px;
                        border-radius: 10px;
                        margin: 20px 0;
                        font-weight: bold;
                    }
                    .status.connected { background: #d4edda; color: #155724; }
                    .status.connecting { background: #fff3cd; color: #856404; }
                    .form-group {
                        margin: 20px 0;
                        text-align: left;
                    }
                    label {
                        display: block;
                        margin-bottom: 5px;
                        color: #555;
                        font-weight: bold;
                    }
                    input {
                        width: 100%;
                        padding: 12px;
                        border: 2px solid #ddd;
                        border-radius: 8px;
                        font-size: 16px;
                        box-sizing: border-box;
                    }
                    input:focus {
                        border-color: #667eea;
                        outline: none;
                    }
                    button {
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        font-size: 16px;
                        border-radius: 8px;
                        cursor: pointer;
                        width: 100%;
                        font-weight: bold;
                    }
                    button:hover {
                        background: #764ba2;
                    }
                    .code-display {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 10px;
                        margin: 20px 0;
                        font-size: 32px;
                        font-weight: bold;
                        letter-spacing: 5px;
                        color: #28a745;
                        border: 2px dashed #28a745;
                    }
                    .error {
                        color: #dc3545;
                        background: #f8d7da;
                        padding: 10px;
                        border-radius: 5px;
                        margin: 10px 0;
                    }
                    .back-btn {
                        display: inline-block;
                        margin-top: 20px;
                        color: #667eea;
                        text-decoration: none;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🤖 SHADOW Bot</h1>
                    
                    <div class="status ${botReady ? 'connected' : 'connecting'}">
                        Bot Status: ${botReady ? '✅ Connected' : '⏳ Connecting...'}
                    </div>
                    
                    <form action="/generate-pair" method="POST">
                        <div class="form-group">
                            <label>📱 Phone Number (with country code):</label>
                            <input 
                                type="text" 
                                name="number" 
                                placeholder="e.g., 919876543210" 
                                required
                                pattern="[0-9]{10,15}"
                                title="Enter 10-15 digits number with country code"
                            >
                            <small style="color: #666;">Example: 919876543210 (India), 12345678901 (US)</small>
                        </div>
                        <button type="submit">Generate Pairing Code</button>
                    </form>
                    
                    ${pendingPairingCode ? `
                        <div style="margin-top: 30px;">
                            <h3>✅ Your Pairing Code:</h3>
                            <div class="code-display">${pendingPairingCode}</div>
                            <p style="color: #666;">Open WhatsApp → Linked Devices → Link a Device</p>
                        </div>
                    ` : ''}
                    
                    <div style="margin-top: 20px; font-size: 12px; color: #999;">
                        <p>Make sure your WhatsApp is updated to latest version</p>
                    </div>
                </div>
            </body>
        </html>
    `)
})

// FIXED: Handle form POST properly
app.post('/generate-pair', async (req, res) => {
    console.log('Form received:', req.body) // Debug log
    
    const { number } = req.body
    if (!number || number.trim() === '') {
        return res.send(`
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { font-family: Arial; text-align: center; padding: 50px; background: #f8d7da; }
                        .error-box { background: white; padding: 30px; border-radius: 10px; max-width: 400px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div class="error-box">
                        <h1 style="color: #dc3545;">❌ Error</h1>
                        <p>Phone number is required!</p>
                        <a href="/" style="color: #667eea;">← Go Back</a>
                    </div>
                </body>
            </html>
        `)
    }
    
    try {
        if (!XeonBotInc) {
            return res.send(`
                <html>
                    <head>
                        <style>
                            body { font-family: Arial; text-align: center; padding: 50px; background: #fff3cd; }
                            .box { background: white; padding: 30px; border-radius: 10px; max-width: 400px; margin: 0 auto; }
                        </style>
                    </head>
                    <body>
                        <div class="box">
                            <h1 style="color: #856404;">⏳ Please Wait</h1>
                            <p>Bot is connecting... Please refresh in 10 seconds.</p>
                            <a href="/" style="color: #667eea;">← Refresh</a>
                        </div>
                    </body>
                </html>
            `)
        }
        
        // Clean number - remove all non-digits
        const formattedNumber = number.toString().replace(/\D/g, '')
        console.log('Generating code for:', formattedNumber)
        
        // Generate pairing code
        let code = await XeonBotInc.requestPairingCode(formattedNumber)
        
        // Format code nicely
        if (code) {
            code = code.match(/.{1,4}/g)?.join("-") || code
            pendingPairingCode = code
            pairingCodeGenerated = true
            
            console.log(chalk.green(`✅ Pairing Code for ${formattedNumber}: ${code}`))
        }
        
        // Show success page
        res.send(`
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { 
                            font-family: Arial; 
                            text-align: center; 
                            padding: 20px; 
                            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                            min-height: 100vh;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            margin: 0;
                        }
                        .success-box {
                            background: white;
                            padding: 40px;
                            border-radius: 20px;
                            max-width: 500px;
                            width: 90%;
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                        }
                        .code {
                            font-size: 48px;
                            font-weight: bold;
                            letter-spacing: 10px;
                            background: #f8f9fa;
                            padding: 20px;
                            border-radius: 10px;
                            margin: 20px 0;
                            color: #28a745;
                            border: 2px dashed #28a745;
                        }
                        .steps {
                            text-align: left;
                            background: #f8f9fa;
                            padding: 20px;
                            border-radius: 10px;
                            margin: 20px 0;
                        }
                        button {
                            background: #28a745;
                            color: white;
                            border: none;
                            padding: 15px 30px;
                            font-size: 18px;
                            border-radius: 8px;
                            cursor: pointer;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="success-box">
                        <h1>✅ Success!</h1>
                        <h2>Your Pairing Code:</h2>
                        <div class="code">${code}</div>
                        
                        <div class="steps">
                            <h3>📱 Steps:</h3>
                            <ol>
                                <li>Open WhatsApp on your phone</li>
                                <li>Tap Menu (3 dots) or Settings</li>
                                <li>Go to <strong>Linked Devices</strong></li>
                                <li>Tap <strong>Link a Device</strong></li>
                                <li>Enter this code: <strong>${code}</strong></li>
                            </ol>
                        </div>
                        
                        <p style="color: #666;">Code also saved and logged</p>
                        <button onclick="window.location.href='/'">← Generate New Code</button>
                    </div>
                </body>
            </html>
        `)
        
    } catch (err) {
        console.error('Pairing error:', err)
        res.send(`
            <html>
                <head>
                    <style>
                        body { font-family: Arial; text-align: center; padding: 50px; background: #f8d7da; }
                        .error-box { background: white; padding: 30px; border-radius: 10px; max-width: 400px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    <div class="error-box">
                        <h1 style="color: #dc3545;">❌ Error</h1>
                        <p>${err.message}</p>
                        <a href="/" style="color: #667eea;">← Try Again</a>
                    </div>
                </body>
            </html>
        `)
    }
})

// API endpoint for JSON
app.post('/api/pair', async (req, res) => {
    const { number } = req.body
    if (!number) return res.status(400).json({ error: 'Phone number required' })
    
    try {
        if (!XeonBotInc) return res.status(500).json({ error: 'Bot not ready' })
        
        const formattedNumber = number.replace(/\D/g, '')
        let code = await XeonBotInc.requestPairingCode(formattedNumber)
        code = code?.match(/.{1,4}/g)?.join("-") || code
        
        res.json({ 
            success: true, 
            code: code,
            message: 'Use this code in WhatsApp Linked Devices'
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

app.get('/status', (req, res) => {
    res.json({
        botReady: botReady,
        connected: botReady,
        hasCode: !!pendingPairingCode,
        code: pendingPairingCode
    })
})

app.listen(PORT, () => {
    console.log(chalk.green(`✅ Server running on port ${PORT}`))
    console.log(chalk.blue(`🌐 Open http://localhost:${PORT} in browser`))
})

// -------------------
// Bot Start Function (same as before)
// -------------------
async function startXeonBotInc() {
    try {
        console.log(chalk.yellow('🚀 Starting SHADOW Bot...'))
        
        let { version } = await fetchLatestBaileysVersion()
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

        // Handle connection
        XeonBotInc.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update
            
            if (connection === 'open') {
                botReady = true
                console.log(chalk.green('✅ Bot connected!'))
            }
            
            if (connection === 'close') {
                botReady = false
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401
                if (shouldReconnect) {
                    setTimeout(startXeonBotInc, 5000)
                }
            }
        })

        XeonBotInc.ev.on('creds.update', saveCreds)
        store.bind(XeonBotInc.ev)

        // Message handlers
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            const mek = chatUpdate.messages[0]
            if(!mek?.message) return
            await handleMessages(XeonBotInc, chatUpdate, true)
        })

        XeonBotInc.ev.on('group-participants.update', async update => await handleGroupParticipantUpdate(XeonBotInc, update))
        
        console.log(chalk.green(`🤖 Bot initialized!`))

    } catch (error) {
        console.error('Error:', error)
        setTimeout(startXeonBotInc, 5000)
    }
}

startXeonBotInc()

process.on('uncaughtException', err => console.error('Uncaught Exception:', err))
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err))
