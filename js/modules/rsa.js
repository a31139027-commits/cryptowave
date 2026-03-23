/**
 * modules/rsa.js — RSA Encryption / Decryption + Key Generation
 * Uses: Web Crypto API (RSA-OAEP) + JSEncrypt (PKCS1) via CDN
 * Supports: RSA-OAEP (SHA-256/SHA-512), PKCS#1 v1.5
 * Key sizes: 1024, 2048, 4096 bit
 */

'use strict';

const RSAModule = (() => {

  let generatedKeyPair = null; // { publicKey, privateKey } PEM strings

  /* ── Web Crypto RSA-OAEP ──────────────────────────────── */

  async function generateKeyPair(bits = 2048, hashAlgo = 'SHA-256') {
    const pair = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: hashAlgo },
      true, ['encrypt', 'decrypt']
    );
    const pub  = await crypto.subtle.exportKey('spki', pair.publicKey);
    const priv = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
    return {
      publicKey:  pemEncode(pub,  'PUBLIC KEY'),
      privateKey: pemEncode(priv, 'PRIVATE KEY'),
      rawPub:     pair.publicKey,
      rawPriv:    pair.privateKey,
    };
  }

  async function encryptOAEP(plaintext, publicKeyPem, hashAlgo = 'SHA-256') {
    const keyBuf = pemDecode(publicKeyPem, 'PUBLIC KEY');
    const key    = await crypto.subtle.importKey(
      'spki', keyBuf, { name: 'RSA-OAEP', hash: hashAlgo }, false, ['encrypt']
    );
    const enc    = new TextEncoder();
    const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, enc.encode(plaintext));
    return Utils.bufToBase64(cipher);
  }

  async function decryptOAEP(cipherB64, privateKeyPem, hashAlgo = 'SHA-256') {
    const keyBuf = pemDecode(privateKeyPem, 'PRIVATE KEY');
    const key    = await crypto.subtle.importKey(
      'pkcs8', keyBuf, { name: 'RSA-OAEP', hash: hashAlgo }, false, ['decrypt']
    );
    const plain  = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' }, key, Utils.base64ToBuf(cipherB64)
    );
    return new TextDecoder().decode(plain);
  }

  /* ── JSEncrypt PKCS1 (via window.JSEncrypt) ───────────── */

  function encryptPKCS1(plaintext, publicKeyPem) {
    if (!window.JSEncrypt) throw new Error('JSEncrypt not loaded');
    const enc = new window.JSEncrypt();
    enc.setPublicKey(publicKeyPem);
    const result = enc.encrypt(plaintext);
    if (!result) throw new Error('Encryption failed — check public key and input length');
    return result;
  }

  function decryptPKCS1(cipherB64, privateKeyPem) {
    if (!window.JSEncrypt) throw new Error('JSEncrypt not loaded');
    const enc = new window.JSEncrypt();
    enc.setPrivateKey(privateKeyPem);
    const result = enc.decrypt(cipherB64);
    if (!result) throw new Error('Decryption failed — check private key');
    return result;
  }

  /* ── PEM helpers ──────────────────────────────────────── */

  function pemEncode(buffer, label) {
    const base64 = Utils.bufToBase64(buffer);
    const lines   = base64.match(/.{1,64}/g).join('\n');
    return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
  }

  function pemDecode(pem, label) {
    const b64 = pem.replace(`-----BEGIN ${label}-----`, '')
                   .replace(`-----END ${label}-----`, '')
                   .replace(/\s/g, '');
    return Utils.base64ToBuf(b64);
  }

  /* ── UI Init ──────────────────────────────────────────── */

  function init() {
    const genBtn  = document.getElementById('rsa-gen-btn');
    if (!genBtn) return;

    const bitsEl    = document.getElementById('rsa-bits');
    const hashEl    = document.getElementById('rsa-hash');
    const pubBox    = document.getElementById('rsa-public-key');
    const privBox   = document.getElementById('rsa-private-key');
    const inputEl   = document.getElementById('rsa-input');
    const outBox    = document.getElementById('rsa-output');
    const encBtn    = document.getElementById('rsa-encrypt-btn');
    const decBtn    = document.getElementById('rsa-decrypt-btn');
    const modeEl    = document.getElementById('rsa-mode');
    const copyPub   = document.getElementById('rsa-copy-pub');
    const copyPriv  = document.getElementById('rsa-copy-priv');
    const copyOut   = document.getElementById('rsa-copy-out');
    const clearBtn  = document.getElementById('rsa-clear-btn');
    const genLoader = document.getElementById('rsa-gen-loader');

    // Generate key pair
    genBtn.addEventListener('click', async () => {
      Utils.setLoading(genBtn, true);
      if (genLoader) genLoader.classList.remove('hidden');
      try {
        const bits  = parseInt(bitsEl.value) || 2048;
        const hash  = hashEl.value || 'SHA-256';
        generatedKeyPair = await generateKeyPair(bits, hash);
        pubBox.value  = generatedKeyPair.publicKey;
        privBox.value = generatedKeyPair.privateKey;
        Utils.showToast(`🔑 ${bits}-bit RSA key pair generated`);
      } catch (err) {
        Utils.showToast(`Error: ${err.message}`);
      }
      Utils.setLoading(genBtn, false);
      if (genLoader) genLoader.classList.add('hidden');
    });

    // Encrypt
    encBtn.addEventListener('click', async () => {
      if (!Utils.requireField(inputEl, 'Plaintext')) return;
      if (!pubBox.value.trim()) { Utils.showToast('⚠ Public key is required'); return; }
      Utils.setLoading(encBtn, true);
      try {
        let result;
        const mode = modeEl.value;
        if (mode === 'OAEP') {
          result = await encryptOAEP(inputEl.value, pubBox.value, hashEl.value || 'SHA-256');
        } else {
          result = encryptPKCS1(inputEl.value, pubBox.value);
        }
        Utils.setOutput(outBox, result, 'success');
      } catch (err) {
        Utils.setOutput(outBox, `Error: ${err.message}`, 'error');
      }
      Utils.setLoading(encBtn, false);
    });

    // Decrypt
    decBtn.addEventListener('click', async () => {
      if (!Utils.requireField(inputEl, 'Ciphertext')) return;
      if (!privBox.value.trim()) { Utils.showToast('⚠ Private key is required'); return; }
      Utils.setLoading(decBtn, true);
      try {
        let result;
        const mode = modeEl.value;
        if (mode === 'OAEP') {
          result = await decryptOAEP(inputEl.value, privBox.value, hashEl.value || 'SHA-256');
        } else {
          result = decryptPKCS1(inputEl.value, privBox.value);
        }
        Utils.setOutput(outBox, result, 'success');
      } catch (err) {
        Utils.setOutput(outBox, 'Decryption failed — ensure correct private key and matching mode.', 'error');
      }
      Utils.setLoading(decBtn, false);
    });

    if (copyPub)  copyPub.addEventListener('click',  () => Utils.copyToClipboard(pubBox.value,  'Public key copied'));
    if (copyPriv) copyPriv.addEventListener('click', () => Utils.copyToClipboard(privBox.value, 'Private key copied'));
    if (copyOut)  copyOut.addEventListener('click',  () => Utils.copyToClipboard(outBox.textContent, 'Output copied'));
    if (clearBtn) clearBtn.addEventListener('click',  () => {
      inputEl.value = '';
      Utils.setOutput(outBox, '', 'default');
      outBox.innerHTML = '<span class="placeholder">Output will appear here…</span>';
    });
  }

  return { init, generateKeyPair, encryptOAEP, decryptOAEP, encryptPKCS1, decryptPKCS1 };

})();

document.addEventListener('DOMContentLoaded', () => { RSAModule.init(); Utils.initNavbar(); });
window.RSAModule = RSAModule;
