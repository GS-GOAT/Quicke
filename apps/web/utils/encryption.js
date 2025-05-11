// Simple encryption/decryption for client-side storage
// Note: This is not meant for high-security applications
// It just provides basic obfuscation to prevent casual access to API keys

// Secret key based on domain and a constant
const SECRET_KEY = typeof window !== 'undefined' 
  ? `quicke-${window.location.hostname}-enc-key-v1` 
  : 'quicke-default-enc-key-v1';

/**
 * Basic encryption function to protect sensitive data in localStorage
 * @param {string} data - String data to encrypt
 * @returns {string} - Encrypted data
 */
export function encrypt(data) {
  if (typeof data !== 'string') return '';
  
  // Create a simple XOR cipher with the SECRET_KEY
  let result = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
    result += String.fromCharCode(charCode);
  }
  
  // Convert to base64 for safer storage
  return btoa(result);
}

/**
 * Basic decryption function to retrieve protected data from localStorage
 * @param {string} encryptedData - Encrypted string data
 * @returns {string} - Decrypted data
 */
export function decrypt(encryptedData) {
  if (typeof encryptedData !== 'string') return '';
  
  try {
    // Convert from base64
    const data = atob(encryptedData);
    
    // Reverse the XOR cipher
    let result = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      result += String.fromCharCode(charCode);
    }
    
    return result;
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
} 