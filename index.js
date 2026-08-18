import "./settings.js";
import main from '#main';
import events from '#events';
import * as Bail from '@whiskeysockets/baileys';

const b = Bail.default || Bail;
const makeWASocket = typeof b === 'function' ? b : (b.default || Bail.makeWASocket);
const fetchLatestBaileysVersion = b.fetchLatestBaileysVersion || Bail.fetchLatestBaileysVersion;
const Browsers = b.Browsers || Bail.Browsers;
const makeCacheableSignalKeyStore = b.makeCacheableSignalKeyStore || Bail.makeCacheableSignalKeyStore;
const jidDecode = b.jidDecode || Bail.jidDecode;
const DisconnectReason = b.DisconnectReason || Bail.DisconnectReason;

const { version } = await fetchLatestBaileysVersion();

import pino from "pino";
import qrcode from "qrcode-terminal";
import chalk from "chalk";
import cfonts from "cfonts";
import fs from "fs";
import path from "path";
import { smsg, getCachedMeta, setCachedMeta } from "#serialize";
import cmdsLoader from '#system/cmdsLoader';
import "#system/database";
import { startSubBot } from './cmds/socket/subs.js';
import db from '#db';
import express from 'express';
import mongoose from 'mongoose';
import { useMongoDBAuthState } from 'mongo-baileys';

const log = {
  info: (msg) => console.log(chalk.bgBlue.white.bold(`INFO`), chalk.white(msg)),
  success: (msg) => console.log(chalk.bgGreen.white.bold(`SUCCESS`), chalk.greenBright(msg)),
  warn: (msg) => console.log(chalk.bgYellowBright.blueBright.bold(`WARNING`), chalk.yellow(msg)),
  error: (msg) => console.log(chalk.bgRed.white.bold(`ERROR`), chalk.redBright(msg))
};

function normalizePhone(input) {
  let s = String(input).replace(/\D/g, '');
  if (!s) return '';
  if (s.startsWith('0')) s = s.replace(/^0+/, '');
  if (s.length === 10 && s.startsWith('3')) s = '57' + s;
  //if (s.startsWith('52') && !s.startsWith('521') && s.length >= 12) s = '521' + s.slice(2);
  if (s.startsWith('54') && !s.startsWith('549') && s.length >= 11) s = '549' + s.slice(2);
  return s;
}

const { say } = cfonts;
console.log(chalk.magentaBright('\n❀ Iniciando...'));
say('Yuki Suou', { align: 'center', gradient: ['red', 'blue'] });
say('Made with love by Destroy', { font: 'console', align: 'center', gradient: ['blue', 'magenta'] });

const botTypes = [
  { name: 'SubBot', folder: './Sessions/Subs', starter: startSubBot },
];
if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true });
global.conns = global.conns || [];
const reconnecting = new Set();
const msgStore = new Map();
const msgLimit = 500;

async function loadBots() {
  for (const { name, folder, starter } of botTypes) {
    if (!fs.existsSync(folder)) continue;
    const botIds = fs.readdirSync(folder);
    for (const userId of botIds) {
      const sessionPath = path.join(folder, userId);
      const credsPath = path.join(sessionPath, 'creds.json');
      if (!fs.existsSync(credsPath)) continue;
      if (global.conns.some((conn) => conn.userId === userId)) continue;
      if (reconnecting.has(userId)) continue;
      try {
        reconnecting.add(userId);
        await starter(null, null, '', false, userId, '');
      } catch (e) {
        reconnecting.delete(userId);
      }
      await new Promise((res) => setTimeout(res, 2500));
    }
  }
  setTimeout(loadBots, 60 * 1000);
}

async function initDB() {
  db.initDB();
  global.db = db;
  console.log(chalk.gray('[ ✿ ] Base de datos (Local) cargada correctamente.'));
}

function cleanCache() {
  try {
    if (fs.existsSync('./tmp')) {
      const files = fs.readdirSync('./tmp');
      for (const file of files) {
        try { fs.unlinkSync(path.join('./tmp', file)); } catch {}
      }
    }
  } catch (e) {}
}

// Configuración dinámica del número para Render
const envPhone = process.env.BOT_NUMERO || "";
let phoneNumber = envPhone ? normalizePhone(envPhone) : "";

if (phoneNumber) {
  console.log(chalk.bold.cyanBright(`\n[NUBE] Número configurado desde Render: +${phoneNumber}\n`));
} else {
  console.log(chalk.bold.yellowBright(`\n[NUBE] No se configuró la variable BOT_NUMERO en Render. El bot iniciará con la sesión existente.\n`));
}

let bootTime = Date.now();
let reconexion = 0;
let botReady = false;
let isRestarting = false;
const retriesLimit = 15;

async function warmupGroups(sockInstance) {
  try {
    const allChats = db.getChat()
    const chatIds = allChats.map(c => c.id).filter(id => typeof id === 'string' && id.endsWith('@g.us')).slice(0, 50)
    if (!chatIds.length) return
    const batches = []
    for (let i = 0; i < chatIds.length; i += 10) {
      batches.push(chatIds.slice(i, i + 10))
    }
    await Promise.allSettled(batches.map(batch => Promise.allSettled(batch.map(async id => {
    try {
    const meta = await sockInstance.groupMetadata(id)
    if (meta) setCachedMeta(id, meta) } catch {}}))))
  } catch (e) {}
}

export async function startBot() {
  if (isRestarting) return;
  isRestarting = true;
  bootTime = Date.now();

  const mongoUrl = process.env.MONGO_URI;
  if (!mongoUrl) {
      log.error("Falta la variable MONGO_URI en Render.");
      process.exit(1);
  }
  
  if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUrl);
      console.log(chalk.green('[ ✿ ] Conectado a MongoDB Atlas exitosamente.'));
      await new Promise(resolve => setTimeout(resolve, 2000));
  }
  const collection = mongoose.connection.db.collection("session_owner");
  const { state, saveCreds: saveCredsDB } = await useMongoDBAuthState(collection);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    browser: Browsers.macOS('Desktop'), 
    printQRInTerminal: false,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
    markOnlineOnConnect: true,
    syncFullHistory: false,       
    generateHighQualityLinkPreview: true,
    shouldIgnoreJid: (jid) => jid.endsWith('@broadcast'),
    keepAliveIntervalMs: 30_000,  
    getMessage: async (key) => msgStore.get(key.remoteJid + ':' + key.id),
  });

  global.sock = sock;
  sock.ev.on("creds.update", saveCredsDB);
  
  sock.sendText = (jid, text, quoted = "", options) => sock.sendMessage(jid, { text, ...options }, { quoted });
  sock.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    }
    return jid;
  };

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (!botReady || type !== 'notify') return;
    for (const msg of messages) {
      if (msg?.message && msg?.key?.id) {
        const sid = msg.key.remoteJid + ':' + msg.key.id;
        msgStore.set(sid, msg.message);
        if (msgStore.size > msgLimit) msgStore.delete(msgStore.keys().next().value);
      }
      try {
        if (!msg?.message || msg.key?.remoteJid === "status@broadcast") continue;
        const m = await smsg(sock, msg);
        if (typeof main === 'function') main(sock, m, messages).catch((err) => console.error(err));
      } catch (err) { console.error('Error:', err); }
    }
  });

  // Solicitud de código de emparejamiento segura para Render
  let pairingRequested = false;
  
  if (!state.creds.registered && phoneNumber) {
    setTimeout(async () => {
      if (pairingRequested) return;
      try {
        if (!sock.authState.creds.registered) {
          pairingRequested = true;
          const pairing = await sock.requestPairingCode(phoneNumber);
          const codeBot = pairing?.match(/.{1,4}/g)?.join("-") || pairing;
          console.log(chalk.bold.white(chalk.bgMagenta(` Código de emparejamiento: `)), chalk.bold.white(codeBot));
          console.log(chalk.bold.cyan(`Ingresa este código en las notificaciones de WhatsApp de tu celular.`));
        }
      } catch (err) {
        pairingRequested = false;
        console.log(chalk.red("Error al generar código:"), err);
      }
    }, 6000); 
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, receivedPendingNotifications } = update;
    
    if (connection === "open") {
      bootTime = Date.now();
      reconexion = 0;
      isRestarting = false;
      log.success(`[ ✿ ] Conectado a: ${sock.user?.name || "Desconocido"}`);
      if (!botReady) {
        botReady = true;
        warmupGroups(sock);
      }
    }
    
    if (receivedPendingNotifications === true) {
      log.warn("Por favor espere aproximadamente 1 minuto...");
      sock.ev.flush();
    }
    
    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode || 0;
      if ([DisconnectReason.loggedOut, DisconnectReason.forbidden, DisconnectReason.multideviceMismatch].includes(reason)) {
        log.error(`Sesión inválida o desvinculada desde el teléfono (Error: ${reason}).`);
        log.warn(`Debes ir a MongoDB Atlas y borrar la colección 'session_owner' si deseas vincular otro número.`);
        botReady = false;
        isRestarting = false;
        process.exit(1); 
      }
      if (reason === DisconnectReason.connectionReplaced) {
        log.warn("Conexión reemplazada — cerrá la otra sesión antes de reconectar.");
        isRestarting = false;
        return;
      }
      reconexion++;
      if (reconexion > retriesLimit) {
        log.error(`Demasiados reintentos de conexión (${retriesLimit}). Forzando reinicio del servidor...`);
        botReady = false;
        reconexion = 0;
        isRestarting = false;
        process.exit(1); 
      }
      const delay = Math.min(3000 * reconexion, 30000);
      log.warn(`Desconexión temporal (${reason}), reconectando en ${delay / 1000}s...`);
      isRestarting = false;
      setTimeout(startBot, delay);
    }
  });

  try { await events(sock, null); } catch (err) {}
}

setInterval(cleanCache, 60 * 60 * 1000);
cleanCache();

(async () => {
  await initDB();
  await cmdsLoader();
  loadBots();
  await startBot();
})();

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => { res.send('¡YukiBot-MD está activo, funcionando 24/7 y conectado a MongoDB!'); });
app.listen(PORT, () => { console.log(`Servidor web interno escuchando en el puerto ${PORT}`); });
