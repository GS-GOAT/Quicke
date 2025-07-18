// Simple encryption/decryption for client-side storage

const SECRET_KEY = typeof window !== 'undefined' 
  ? `quicke-${window.location.hostname}-enc-key-v1` 
  : 'quicke-default-enc-key-v1';

export function encrypt(data) {
  if (typeof data !== 'string') return '';
  let result = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(result);
}

export function decrypt(encryptedData) {
  if (typeof encryptedData !== 'string') return '';
  try {
    const data = atob(encryptedData);
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