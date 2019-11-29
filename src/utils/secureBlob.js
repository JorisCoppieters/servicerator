'use strict'; // JS: ES6

// ******************************
// Requires:
// ******************************

const crypto = require('crypto');
const os = require('os');

// ******************************
// Function Exports:
// ******************************

module.exports['encrypt'] = (authBlob) => {
    _checkIsSet(authBlob, 'secureBlob.encryptBlob - authBlob');
    return _encrypt(JSON.stringify(authBlob || false));
};

// ******************************

module.exports['decrypt'] = (authBlob) => {
    _checkIsSet(authBlob, 'secureBlob.decryptBlob - authBlob');
    try {
        return JSON.parse(_decrypt(authBlob));
    } catch (err) {
        return null;
    }
};

// ******************************
// Helper Functions:
// ******************************

function _encrypt(in_text){
    const iv = Buffer.from(crypto.randomBytes(16));
    const cipher = crypto.createCipheriv('aes-256-ctr', _getSecretKey(), iv);

    let encrypted = cipher.update(in_text);
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted.toString()}`;
}

// ******************************

function _decrypt(in_encrypted){
    const textParts = in_encrypted.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-ctr', _getSecretKey(), iv);

    const encryptedText = Buffer.from(textParts.join(':'), 'hex');

    let decrypted = decipher.update(encryptedText);
    decrypted += decipher.final('utf8');

    return decrypted.toString();
}

// ******************************

function _getSecretKey() {
    const secret_id = '5B1D4BBA885640EB3CE37810DCE93EEF';
    const salt = os.hostname();
    const hash = crypto.createHash('md5').update(`${secret_id}:${salt}`).digest('hex');
    return hash;
}

// ******************************

function _checkIsSet(in_value, in_displayName) {
    if (typeof(in_value) === 'undefined') throw `${in_displayName} not set!`;
}

// ******************************