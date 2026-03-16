/**
 * SHADOW BOT - Premium Web Pairing
 * Proper @whiskeysockets/baileys with Pakistan number support
 */

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys")
const pino = require("pino")
const express = require("express")
const cors = require("cors")
const chalk = require('chalk')
const NodeCache = require("node-cache")
const fs = require('fs')

// Express setup
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const PORT = process.env.PORT || 3000
let sock = null
let botReady = false

// Pakistan number format helper
function formatPakistanNumber(number) {
    // Remove any non-digit characters
    let clean = number.replace(/\D/g, '')
    
    // If starts with 0, remove it
    if (clean.startsWith('0')) {
        clean = clean.substring(1)
    }
    
    // If doesn't have 92 prefix, add it
    if (!clean.startsWith('92')) {
        clean = '92' + clean
    }
    
    return clean
}

// ==============================================
// PREMIUM WEB INTERFACE
// ==============================================
const htmlTemplate = (content, title = "SHADOW BOT") => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - WhatsApp Pakistan Pairing</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        body {
            min-height: 100vh;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .premium-card {
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(10px);
            border-radius: 40px;
            box-shadow: 0 30px 70px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 550px;
            overflow: hidden;
            animation: slideIn 0.6s cubic-bezier(0.23, 1, 0.32, 1);
            border: 1px solid rgba(255,255,255,0.2);
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(50px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        .premium-header {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
            position: relative;
            overflow: hidden;
        }

        .premium-header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: rotate 20s linear infinite;
        }

        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .premium-header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            position: relative;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .premium-header p {
            opacity: 0.9;
            font-size: 1.2em;
            position: relative;
        }

        .pk-flag {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 5px 15px;
            border-radius: 50px;
            margin-top: 15px;
            font-weight: bold;
            border: 1px solid rgba(255,255,255,0.3);
        }

        .premium-content {
            padding: 40px 35px;
        }

        .status-chip {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 20px;
            border-radius: 50px;
            margin-bottom: 30px;
            font-weight: 600;
            background: #f0f4f8;
            border-left: 4px solid;
        }

        .status-chip.connected {
            border-left-color: #10b981;
            color: #065f46;
        }

        .status-chip.connecting {
            border-left-color: #f59e0b;
            color: #92400e;
        }

        .status-chip .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: currentColor;
            animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

        .input-field {
            margin-bottom: 25px;
        }

        .input-field label {
            display: block;
            margin-bottom: 8px;
            color: #1f2937;
            font-weight: 600;
            font-size: 1em;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .input-field input {
            width: 100%;
            padding: 16px 20px;
            border: 2px solid #e5e7eb;
            border-radius: 20px;
            font-size: 1.1em;
            transition: all 0.3s ease;
            background: #f9fafb;
        }

        .input-field input:focus {
            border-color: #1e3c72;
            outline: none;
            box-shadow: 0 0 0 4px rgba(30, 60, 114, 0.1);
            background: white;
        }

        .input-field small {
            display: block;
            margin-top: 8px;
            color: #6b7280;
            font-size: 0.9em;
        }

        .phone-examples {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 10px;
        }

        .example-badge {
            background: #e5e7eb;
            padding: 5px 12px;
            border-radius: 50px;
            font-size: 0.85em;
            color: #374151;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .example-badge:hover {
            background: #1e3c72;
            color: white;
        }

        .premium-btn {
            width: 100%;
            padding: 18px;
            border: none;
            border-radius: 20px;
            font-size: 1.1em;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            box-shadow: 0 8px 20px rgba(30, 60, 114, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            position: relative;
            overflow: hidden;
        }

        .premium-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s ease;
        }

        .premium-btn:hover::before {
            left: 100%;
        }

        .premium-btn:hover:not(:disabled) {
            transform: translateY(-3px);
            box-shadow: 0 12px 30px rgba(30, 60, 114, 0.4);
        }

        .premium-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            background: #9ca3af;
        }

        .code-container {
            margin-top: 30px;
            padding: 30px;
            background: linear-gradient(135deg, #1e3c7208 0%, #2a529808 100%);
            border-radius: 30px;
            border: 2px dashed #1e3c72;
            text-align: center;
            animation: glow 2s ease-in-out infinite;
        }

        @keyframes glow {
            0%, 100% { box-shadow: 0 0 0 0 rgba(30, 60, 114, 0.2); }
            50% { box-shadow: 0 0 20px 5px rgba(30, 60, 114, 0.3); }
        }

        .code-container h3 {
            color: #1f2937;
            margin-bottom: 15px;
            font-size: 1.3em;
        }

        .pairing-code {
            font-size: 3.5em;
            font-weight: 900;
            letter-spacing: 12px;
            color: #1e3c72;
            background: white;
            padding: 20px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            margin: 20px 0;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            border: 2px solid #1e3c72;
        }

        .steps-guide {
            margin-top: 30px;
            padding: 25px;
            background: #f8fafc;
            border-radius: 20px;
            border: 1px solid #e5e7eb;
        }

        .steps-guide h4 {
            color: #1f2937;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.1em;
        }

        .step-item {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 15px;
            color: #4b5563;
        }

        .step-number {
            width: 30px;
            height: 30px;
            background: #1e3c72;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 0.9em;
            flex-shrink: 0;
        }

        .loader-modern {
            width: 24px;
            height: 24px;
            border: 3px solid #ffffff;
            border-bottom-color: transparent;
            border-radius: 50%;
            display: inline-block;
            animation: rotation 1s linear infinite;
        }

        @keyframes rotation {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .message {
            padding: 16px 20px;
            border-radius: 15px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
        }

        .message.error {
            background: #fee2e2;
            color: #991b1b;
            border-left: 4px solid #dc2626;
        }

        .message.success {
            background: #dcfce7;
            color: #166534;
            border-left: 4px solid #16a34a;
        }

        .footer-note {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 0.9em;
            border-top: 1px solid #e5e7eb;
        }
    </style>
</head>
<body>
    <div class="premium-card">
        <div class="premium-header">
            <h1>🤖 SHADOW BOT</h1>
            <p>Premium WhatsApp Pairing System</p>
            <div class="pk-flag">
                🇵🇰 Pakistan Numbers Supported
            </div>
        </div>
        
        <div class="premium-content">
            ${content}
        </div>
        
        <div class="footer-note">
            <p>⚡ Powered by @whiskeysockets/baileys • Multi-Device</p>
        </div>
    </div>
</body>
</html>
`

// Home page
app.get('/', (req, res) => {
    const statusClass = botReady ? 'connected' : 'connecting'
    const statusText = botReady ? 'Bot Connected & Ready' : 'Bot is Connecting...'
    
    const content = `
        <div class="status-chip ${statusClass}">
            <span class="dot"></span>
            <span>${statusText}</span>
        </div>
        
        <div class="input-field">
            <label>
                <span>📱</span>
                Enter Pakistan Phone Number
            </label>
            <input 
                type="text" 
                id="phoneNumber" 
                placeholder="e.g., 923001234567" 
                required
            >
            <small>Format: 92xxxxxxxxx (without + or spaces)</small>
            <div class="phone-examples">
                <span class="example-badge" onclick="setNumber('923001234567')">923001234567</span>
                <span class="example-badge" onclick="setNumber('923112345678')">923112345678</span>
                <span class="example-badge" onclick="setNumber('923213456789')">923213456789</span>
                <span class="example-badge" onclick="setNumber('923334567890')">923334567890</span>
            </div>
        </div>
        
        <button class="premium-btn" id="generateBtn" onclick="generatePairingCode()">
            <span>Generate Pairing Code</span>
        </button>
        
        <div id="result"></div>
        
        <div class="steps-guide">
            <h4>
                <span>📋</span>
                How to Connect (Pakistan Users)
            </h4>
            
            <div class="step-item">
                <div class="step-number">1</div>
                <div>Enter your number starting with 92 (e.g., 923001234567)</div>
            </div>
            
            <div class="step-item">
                <div class="step-number">2</div>
                <div>Click "Generate Pairing Code" button</div>
            </div>
            
            <div class="step-item">
                <div class="step-number">3</div>
                <div>Open WhatsApp on your phone</div>
            </div>
            
            <div class="step-item">
                <div class="step-number">4</div>
                <div>Go to Settings → Linked Devices → Link a Device</div>
            </div>
            
            <div class="step-item">
                <div class="step-number">5</div>
                <div>Enter the 8-digit code shown below</div>
            </div>
        </div>
        
        <script>
            function setNumber(num) {
                document.getElementById('phoneNumber').value = num
            }
            
            async function generatePairingCode() {
                const number = document.getElementById('phoneNumber').value.trim()
                const btn = document.getElementById('generateBtn')
                const resultDiv = document.getElementById('result')
                
                if (!number) {
                    resultDiv.innerHTML = \`
                        <div class="message error">
                            <span>❌</span>
                            Please enter a phone number
                        </div>
                    \`
                    return
                }
                
                // Validate Pakistan number
                if (!number.startsWith('92')) {
                    resultDiv.innerHTML = \`
                        <div class="message error">
                            <span>❌</span>
                            Pakistan number must start with 92 (e.g., 923001234567)
                        </div>
                    \`
                    return
                }
                
                // Show loading
                btn.innerHTML = '<span class="loader-modern"></span><span>Generating...</span>'
                btn.disabled = true
                
                try {
                    const response = await fetch('/api/pair', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ number })
                    })
                    
                    const data = await response.json()
                    
                    if (data.success) {
                        resultDiv.innerHTML = \`
                            <div class="code-container">
                                <h3>✅ Pairing Code Generated!</h3>
                                <div class="pairing-code">\${data.code}</div>
                                <p style="color: #4b5563; margin-top: 10px;">
                                    Enter this code in WhatsApp to connect
                                </p>
                            </div>
                        \`
                    } else {
                        resultDiv.innerHTML = \`
                            <div class="message error">
                                <span>❌</span>
                                \${data.error || 'Failed to generate code'}
                            </div>
                        \`
                    }
                } catch (error) {
                    resultDiv.innerHTML = \`
                        <div class="message error">
                            <span>❌</span>
                            Connection error: \${error.message}
                        </div>
                    \`
                } finally {
                    btn.innerHTML = '<span>Generate Pairing Code</span>'
                    btn.disabled = false
                }
            }
        </script>
    `
    
    res.send(htmlTemplate(content))
})

// API endpoint for pairing
app.post('/api/pair', async (req, res) => {
    try {
        const { number } = req.body
        
        if (!number) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phone number required' 
            })
        }
        
        if (!sock) {
            return res.status(503).json({ 
                success: false, 
                error: 'Bot not ready yet. Please wait 10 seconds and try again.' 
            })
        }
        
        // Format Pakistan number
        const formattedNumber = formatPakistanNumber(number)
        console.log(chalk.blue(`📱 Generating code for: ${formattedNumber}`))
        
        // Generate pairing code
        let code = await sock.requestPairingCode(formattedNumber)
        
        // Format code as XXXX-XXXX-XXXX-XXXX
        if (code) {
            // Remove any existing formatting
            code = code.replace(/[^0-9]/g, '')
            // Format in groups of 4
            code = code.match(/.{1,4}/g)?.join('-') || code
        }
        
        console.log(chalk.green(`✅ Pairing code: ${code}`))
        
        res.json({
            success: true,
            code: code,
            number: formattedNumber,
            message: 'Pairing code generated successfully'
        })
        
    } catch (error) {
        console.error(chalk.red('❌ Pairing error:'), error)
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate pairing code'
        })
    }
})

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        ready: botReady,
        connected: botReady,
        timestamp: new Date().toISOString()
    })
})

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        bot: botReady ? 'connected' : 'connecting',
        timestamp: new Date().toISOString()
    })
})

// Start server
app.listen(PORT, () => {
    console.log(chalk.green(`
╔════════════════════════════════════╗
║   🚀 SHADOW BOT SERVER RUNNING     ║
╠════════════════════════════════════╣
║  Port: ${PORT}                         ║
║  Pakistan Numbers: ✅ 92           ║
║  Baileys: ✅ Imported              ║
╚════════════════════════════════════╝
    `))
})

// ==============================================
// BOT INITIALIZATION (Proper Baileys)
// ==============================================
async function startBot() {
    try {
        console.log(chalk.yellow('🚀 Initializing SHADOW Bot with Baileys...'))
        
        // Get latest Baileys version
        const { version } = await fetchLatestBaileysVersion()
        console.log(chalk.blue(`📱 Baileys Version: ${version.join('.')}`))
        
        // Setup auth
        const { state, saveCreds } = await useMultiFileAuthState('./session')
        const m
