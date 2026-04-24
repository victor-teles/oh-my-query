use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use keyring::Entry;
use rand::RngCore;
use std::fmt;
use std::sync::OnceLock;

use crate::config::ConfigError;

const KEYRING_SERVICE: &str = "oh-my-query";
const KEYRING_USER: &str = "history-encryption-key";
const KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;

static CACHED_KEY: OnceLock<[u8; KEY_LEN]> = OnceLock::new();

#[derive(Debug)]
pub enum CryptoError {
    Keyring(String),
    InvalidKeyLen,
    Encrypt,
    Decrypt,
    Base64,
    Short,
}

impl fmt::Display for CryptoError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CryptoError::Keyring(msg) => write!(f, "keyring error: {msg}"),
            CryptoError::InvalidKeyLen => write!(f, "invalid key length in keyring"),
            CryptoError::Encrypt => write!(f, "encryption failed"),
            CryptoError::Decrypt => write!(f, "decryption failed"),
            CryptoError::Base64 => write!(f, "base64 decode failed"),
            CryptoError::Short => write!(f, "ciphertext too short"),
        }
    }
}

impl From<CryptoError> for ConfigError {
    fn from(err: CryptoError) -> Self {
        let code = match &err {
            CryptoError::Keyring(_) => "KEYRING_ERROR",
            CryptoError::InvalidKeyLen => "INVALID_KEY_LEN",
            CryptoError::Encrypt => "ENCRYPT_FAILED",
            CryptoError::Decrypt => "DECRYPT_FAILED",
            CryptoError::Base64 => "BASE64_DECODE_FAILED",
            CryptoError::Short => "CIPHERTEXT_TOO_SHORT",
        };
        ConfigError {
            code: code.to_string(),
            message: err.to_string(),
        }
    }
}

fn load_or_create_key() -> Result<[u8; KEY_LEN], CryptoError> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| CryptoError::Keyring(e.to_string()))?;

    match entry.get_password() {
        Ok(encoded) => {
            let bytes = B64
                .decode(encoded.trim())
                .map_err(|_| CryptoError::Base64)?;
            if bytes.len() != KEY_LEN {
                return Err(CryptoError::InvalidKeyLen);
            }
            let mut key = [0u8; KEY_LEN];
            key.copy_from_slice(&bytes);
            Ok(key)
        }
        Err(keyring::Error::NoEntry) => {
            let mut key = [0u8; KEY_LEN];
            rand::thread_rng().fill_bytes(&mut key);
            let encoded = B64.encode(key);
            entry
                .set_password(&encoded)
                .map_err(|e| CryptoError::Keyring(e.to_string()))?;
            Ok(key)
        }
        Err(err) => Err(CryptoError::Keyring(err.to_string())),
    }
}

pub fn get_key() -> Result<&'static [u8; KEY_LEN], CryptoError> {
    if let Some(k) = CACHED_KEY.get() {
        return Ok(k);
    }
    let key = load_or_create_key()?;
    Ok(CACHED_KEY.get_or_init(|| key))
}

fn cipher(key: &[u8; KEY_LEN]) -> Aes256Gcm {
    Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key))
}

pub fn encrypt_line(plaintext: &str) -> Result<String, CryptoError> {
    let key = get_key()?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher(key)
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| CryptoError::Encrypt)?;

    let mut combined = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);
    Ok(B64.encode(combined))
}

pub fn decrypt_line(encoded: &str) -> Result<String, CryptoError> {
    let key = get_key()?;
    let bytes = B64
        .decode(encoded.trim())
        .map_err(|_| CryptoError::Base64)?;
    if bytes.len() <= NONCE_LEN {
        return Err(CryptoError::Short);
    }
    let (nonce_bytes, ciphertext) = bytes.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher(key)
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::Decrypt)?;
    String::from_utf8(plaintext).map_err(|_| CryptoError::Decrypt)
}
