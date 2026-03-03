// Student Thinking Section
/*
 * Why is client-side encryption weaker than server-side?
 * Client-side encryption exposes the encryption logic and potentially the keys (if not handled carefully in memory) to the user's browser environment. Malicious extensions, XSS attacks, or compromised devices can intercept the password or the decrypted data. Server-side encryption happens in a controlled environment where keys can be managed by HSMs or secure KMS.
 * 
 * How can localStorage be tampered with?
 * localStorage is accessible via JavaScript on the same origin. Any XSS vulnerability allows an attacker to read, modify, or delete localStorage contents. Users can also manually edit it via browser DevTools.
 * 
 * What would you change in production?
 * In production, I would use a robust backend for authentication (e.g., OAuth, WebAuthn), store encrypted data on the server, use secure HttpOnly cookies for session management, and implement server-side rate limiting and brute-force protection. I would also use a well-audited library for encryption rather than manual Web Crypto API implementations if possible, and ensure strict CSP headers.
 * 
 * How would you make this multi-user?
 * I would implement a backend database where each user has a unique ID. The client would authenticate with the server, receive a session token, and fetch only their encrypted notes. The server would enforce access controls so users cannot access others' notes. The encryption key would still be derived from the user's password client-side so the server never sees the plaintext notes (Zero-Knowledge architecture).
 */

// --- Manual Logic Implementations ---

// 1. Password Strength Formula
export function calculatePasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 2;
  if (/[A-Z]/.test(password)) score += 2;
  if (/[0-9]/.test(password)) score += 2;
  if (/[^A-Za-z0-9]/.test(password)) score += 2;
  
  let rating = 'very weak';
  if (score >= 8) rating = 'strong';
  else if (score >= 5) rating = 'weak';
  
  return { score, rating };
}

// 2. Event Logging Structure
export function logEvent(eventType: string, details: string) {
  const logs = JSON.parse(localStorage.getItem('vaultLogs') || '[]');
  logs.push({
    timestamp: new Date().toISOString(),
    eventType,
    details
  });
  localStorage.setItem('vaultLogs', JSON.stringify(logs));
}

export function getLogs() {
  return JSON.parse(localStorage.getItem('vaultLogs') || '[]');
}

// 3. Security Scoring System
export function updateSecurityScore(change: number) {
  let score = parseInt(localStorage.getItem('securityScore') || '0');
  score += change;
  localStorage.setItem('securityScore', score.toString());
  return score;
}

export function getSecurityScore() {
  return parseInt(localStorage.getItem('securityScore') || '0');
}

// 4. Anti-Brute-Force Logic
export function checkBruteForce() {
  const attempts = parseInt(localStorage.getItem('failedAttempts') || '0');
  const lockoutTime = parseInt(localStorage.getItem('lockoutTime') || '0');
  
  if (lockoutTime > Date.now()) {
    return { locked: true, remaining: Math.ceil((lockoutTime - Date.now()) / 1000), requireCaptcha: false };
  }
  
  if (attempts >= 3) {
    return { locked: false, remaining: 0, requireCaptcha: true };
  }
  
  return { locked: false, remaining: 0, requireCaptcha: false };
}

export function recordFailedAttempt() {
  let attempts = parseInt(localStorage.getItem('failedAttempts') || '0');
  attempts += 1;
  localStorage.setItem('failedAttempts', attempts.toString());
  
  if (attempts >= 3) {
    // Lock for 10 minutes
    localStorage.setItem('lockoutTime', (Date.now() + 10 * 60 * 1000).toString());
  }
  
  updateSecurityScore(-5);
  logEvent('FAILED_LOGIN', `Failed attempt ${attempts}`);
}

export function resetFailedAttempts() {
  localStorage.removeItem('failedAttempts');
  localStorage.removeItem('lockoutTime');
}

// 5. Encryption Strategy (AES-GCM with PBKDF2)
const ENCRYPTION_ITERATIONS = 100000;

async function getPasswordKey(password: string) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
}

async function deriveKey(passwordKey: CryptoKey, salt: Uint8Array) {
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: ENCRYPTION_ITERATIONS,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptNote(text: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const passwordKey = await getPasswordKey(password);
  const aesKey = await deriveKey(passwordKey, salt);
  
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    enc.encode(text)
  );
  
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function decryptNote(encryptedBase64: string, password: string): Promise<string> {
  try {
    const combinedStr = atob(encryptedBase64);
    const combined = new Uint8Array(combinedStr.length);
    for (let i = 0; i < combinedStr.length; i++) {
      combined[i] = combinedStr.charCodeAt(i);
    }
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const ciphertext = combined.slice(28);
    
    const passwordKey = await getPasswordKey(password);
    const aesKey = await deriveKey(passwordKey, salt);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      ciphertext
    );
    
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (e) {
    throw new Error("Decryption failed. Incorrect password or corrupted data.");
  }
}

// 6. Access Control Flow
export async function hashMasterPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

export function generateSessionToken() {
  return crypto.randomUUID();
}
