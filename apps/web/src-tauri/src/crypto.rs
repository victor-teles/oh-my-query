use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use keyring::Entry;
use rand::RngCore;
use std::fmt;
use std::sync::{Mutex, OnceLock};

use crate::config::ConfigError;

const KEYRING_SERVICE: &str = "oh-my-query";
const KEYRING_USER: &str = "history-encryption-key";
const KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;

static CACHED_KEY: OnceLock<[u8; KEY_LEN]> = OnceLock::new();
static INIT_LOCK: Mutex<()> = Mutex::new(());

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
    let _guard = INIT_LOCK
        .lock()
        .map_err(|_| CryptoError::Keyring("init lock poisoned".to_string()))?;
    if let Some(k) = CACHED_KEY.get() {
        return Ok(k);
    }
    let key = load_or_create_key()?;
    Ok(CACHED_KEY.get_or_init(|| key))
}

fn cipher(key: &[u8; KEY_LEN]) -> Aes256Gcm {
    Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key))
}

pub fn encrypt_with_key(key: &[u8; KEY_LEN], plaintext: &str) -> Result<String, CryptoError> {
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

pub fn decrypt_with_key(key: &[u8; KEY_LEN], encoded: &str) -> Result<String, CryptoError> {
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

pub fn encrypt_line(plaintext: &str) -> Result<String, CryptoError> {
    encrypt_with_key(get_key()?, plaintext)
}

pub fn decrypt_line(encoded: &str) -> Result<String, CryptoError> {
    decrypt_with_key(get_key()?, encoded)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixed_key() -> [u8; KEY_LEN] {
        let mut k = [0u8; KEY_LEN];
        for (i, byte) in k.iter_mut().enumerate() {
            *byte = (i as u8).wrapping_mul(7).wrapping_add(13);
        }
        k
    }

    #[test]
    fn roundtrip_recovers_plaintext() {
        let key = fixed_key();
        let encoded = encrypt_with_key(&key, "hello, world").unwrap();
        let decoded = decrypt_with_key(&key, &encoded).unwrap();
        assert_eq!(decoded, "hello, world");
    }

    #[test]
    fn roundtrip_handles_empty_string() {
        let key = fixed_key();
        let encoded = encrypt_with_key(&key, "").unwrap();
        let decoded = decrypt_with_key(&key, &encoded).unwrap();
        assert_eq!(decoded, "");
    }

    #[test]
    fn roundtrip_handles_unicode() {
        let key = fixed_key();
        let plaintext = "café — 漢字 — 🦀";
        let encoded = encrypt_with_key(&key, plaintext).unwrap();
        let decoded = decrypt_with_key(&key, &encoded).unwrap();
        assert_eq!(decoded, plaintext);
    }

    #[test]
    fn nonce_is_unique_across_calls() {
        let key = fixed_key();
        let a = encrypt_with_key(&key, "same").unwrap();
        let b = encrypt_with_key(&key, "same").unwrap();
        assert_ne!(a, b, "AES-GCM ciphertext must vary because of the nonce");
    }

    #[test]
    fn tampered_ciphertext_fails_with_decrypt_error() {
        let key = fixed_key();
        let encoded = encrypt_with_key(&key, "secret").unwrap();
        let mut bytes = B64.decode(&encoded).unwrap();
        let tail = bytes.len() - 1;
        bytes[tail] ^= 0x01;
        let tampered = B64.encode(&bytes);
        let err = decrypt_with_key(&key, &tampered).unwrap_err();
        assert!(matches!(err, CryptoError::Decrypt));
    }

    #[test]
    fn truncated_ciphertext_fails_with_short_error() {
        let key = fixed_key();
        let short = B64.encode(&[0u8; NONCE_LEN]);
        let err = decrypt_with_key(&key, &short).unwrap_err();
        assert!(matches!(err, CryptoError::Short));
    }

    #[test]
    fn malformed_base64_fails() {
        let key = fixed_key();
        let err = decrypt_with_key(&key, "!!!not-base64!!!").unwrap_err();
        assert!(matches!(err, CryptoError::Base64));
    }

    #[test]
    fn wrong_key_fails_with_decrypt_error() {
        let key = fixed_key();
        let encoded = encrypt_with_key(&key, "secret").unwrap();
        let mut other_key = fixed_key();
        other_key[0] ^= 0xff;
        let err = decrypt_with_key(&other_key, &encoded).unwrap_err();
        assert!(matches!(err, CryptoError::Decrypt));
    }

    #[test]
    fn crypto_error_display_messages_are_distinct() {
        let messages = [
            CryptoError::Keyring("x".into()).to_string(),
            CryptoError::InvalidKeyLen.to_string(),
            CryptoError::Encrypt.to_string(),
            CryptoError::Decrypt.to_string(),
            CryptoError::Base64.to_string(),
            CryptoError::Short.to_string(),
        ];
        let unique: std::collections::HashSet<_> = messages.iter().collect();
        assert_eq!(unique.len(), messages.len());
    }

    #[test]
    fn config_error_codes_round_trip_from_crypto_error() {
        let cases = [
            (CryptoError::Keyring("k".into()), "KEYRING_ERROR"),
            (CryptoError::InvalidKeyLen, "INVALID_KEY_LEN"),
            (CryptoError::Encrypt, "ENCRYPT_FAILED"),
            (CryptoError::Decrypt, "DECRYPT_FAILED"),
            (CryptoError::Base64, "BASE64_DECODE_FAILED"),
            (CryptoError::Short, "CIPHERTEXT_TOO_SHORT"),
        ];
        for (err, code) in cases {
            let cfg: ConfigError = err.into();
            assert_eq!(cfg.code, code);
        }
    }
}
