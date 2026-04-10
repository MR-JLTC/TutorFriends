/**
 * Utility to decode, parse, modify, and regenerate EMVCo-compliant QR Ph P2P payload strings.
 * Based on EMV QR Code Merchant-Presented Mode (MPM) specification.
 */
import jsQR from 'jsqr';

/**
 * Calculates CRC-16/CCITT-FALSE (Polynomial: 0x1021, Init: 0xFFFF, RefIn/RefOut: False)
 */
export const crc16ccitt = (data: string): string => {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/**
 * Formats a Tag-Length-Value (TLV) data object.
 */
export const formatTLV = (tag: string, value: string): string => {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
};

/**
 * Parses an EMVCo TLV payload string into an ordered array of [tag, value] pairs.
 * Preserves ordering so the payload can be reconstructed identically.
 */
export const parseTLV = (payload: string): Array<[string, string]> => {
  const entries: Array<[string, string]> = [];
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.substring(i, i + 2);
    const len = parseInt(payload.substring(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > payload.length) break;
    const value = payload.substring(i + 4, i + 4 + len);
    entries.push([tag, value]);
    i += 4 + len;
  }
  return entries;
};

/**
 * Decodes a QR code from an image URL.
 * Returns the decoded string payload or null if decoding fails.
 */
export const decodeQRFromImageUrl = (imageUrl: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, canvas.width, canvas.height);
        resolve(result ? result.data : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

/**
 * Takes a base EMVCo payload (decoded from a valid GCash QR) and injects/modifies
 * the amount (tag 54) and point-of-initiation method (tag 01).
 * Recalculates CRC-16 (tag 63).
 */
export const injectAmountIntoPayload = (
  basePayload: string,
  amount: string | number
): string => {
  // Strip existing CRC (tag 63 — always the last 8 chars: "6304" + 4-char checksum)
  let stripped = basePayload;
  if (stripped.length >= 8 && stripped.substring(stripped.length - 8, stripped.length - 4) === '6304') {
    stripped = stripped.substring(0, stripped.length - 8);
  }

  // Parse remaining TLV entries
  const entries = parseTLV(stripped);

  // Build new payload: modify tag 01, add/replace tag 54, keep everything else
  const result: string[] = [];
  let addedAmount = false;

  for (const [tag, value] of entries) {
    if (tag === '01') {
      // Change to dynamic (12) when amount is present
      result.push(formatTLV('01', '12'));
    } else if (tag === '54') {
      // Replace existing amount
      const formattedAmount = Number(amount).toFixed(2);
      result.push(formatTLV('54', formattedAmount));
      addedAmount = true;
    } else if (tag === '63') {
      // Skip old CRC — we'll recalculate
      continue;
    } else {
      result.push(formatTLV(tag, value));
    }
  }

  // If tag 54 didn't exist in the original, insert it after tag 53 (currency)
  if (!addedAmount) {
    const formattedAmount = Number(amount).toFixed(2);
    const idx = result.findIndex(s => s.startsWith('53'));
    if (idx !== -1) {
      result.splice(idx + 1, 0, formatTLV('54', formattedAmount));
    } else {
      // Fallback: add before the last element
      result.push(formatTLV('54', formattedAmount));
    }
  }

  // Add CRC placeholder and calculate
  const partialPayload = result.join('') + '6304';
  const checksum = crc16ccitt(partialPayload);

  return partialPayload + checksum;
};
