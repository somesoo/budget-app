#!/usr/bin/env node
// Encrypts / decrypts the data file behind the password-protected /mapa page.
//
//   MAPA_PASSWORD=... node scripts/mapa-crypt.mjs encrypt data.json public/mapa-data.enc
//   MAPA_PASSWORD=... node scripts/mapa-crypt.mjs decrypt public/mapa-data.enc data.json
//
// To change the password: decrypt with the old one, encrypt with the new one.
// Only the encrypted file is committed; public/mapa.html decrypts it in the
// browser (PBKDF2-SHA256 -> AES-256-GCM, gzip inside), so the data never sits
// on the server in the clear. Keep the plaintext JSON and the password out of git.
//
// File layout: "MAPA1" | iterations u32be | salt 16 | iv 12 | ciphertext+tag
import { readFileSync, writeFileSync } from 'node:fs'
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'

const MAGIC = Buffer.from('MAPA1')
const ITER = 600_000

const [mode, input, output] = process.argv.slice(2)
const password = process.env.MAPA_PASSWORD
if (!['encrypt', 'decrypt'].includes(mode) || !input || !output || !password) {
  console.error('usage: MAPA_PASSWORD=... node scripts/mapa-crypt.mjs <encrypt|decrypt> <in> <out>')
  process.exit(1)
}

const key = (salt, iter) => pbkdf2Sync(password, salt, iter, 32, 'sha256')

if (mode === 'encrypt') {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(salt, ITER), iv)
  const ct = Buffer.concat([cipher.update(gzipSync(readFileSync(input), { level: 9 })), cipher.final()])
  const iter = Buffer.alloc(4)
  iter.writeUInt32BE(ITER)
  writeFileSync(output, Buffer.concat([MAGIC, iter, salt, iv, ct, cipher.getAuthTag()]))
} else {
  const buf = readFileSync(input)
  if (!buf.subarray(0, 5).equals(MAGIC)) throw new Error('not a MAPA1 file')
  const iter = buf.readUInt32BE(5)
  const salt = buf.subarray(9, 25)
  const iv = buf.subarray(25, 37)
  const body = buf.subarray(37, buf.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key(salt, iter), iv)
  decipher.setAuthTag(buf.subarray(buf.length - 16))
  writeFileSync(output, gunzipSync(Buffer.concat([decipher.update(body), decipher.final()])))
}
