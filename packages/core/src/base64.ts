import * as base64js from 'base64-js';

/**
 * UTF-8-safe base64 encode/decode with no environment dependency — works
 * identically across Node, Electron's renderer, and React Native/Hermes,
 * none of which are guaranteed to provide `btoa`/`atob`/`Buffer`/`TextEncoder`.
 */
export function utf8ToBase64(str: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        i++;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return base64js.fromByteArray(new Uint8Array(bytes));
}

export function base64ToUtf8(b64: string): string {
  const bytes = base64js.toByteArray(b64);
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++]!;
    let code: number;
    let extra: number;
    if (b0 < 0x80) { code = b0; extra = 0; }
    else if ((b0 & 0xe0) === 0xc0) { code = b0 & 0x1f; extra = 1; }
    else if ((b0 & 0xf0) === 0xe0) { code = b0 & 0x0f; extra = 2; }
    else { code = b0 & 0x07; extra = 3; }
    for (let j = 0; j < extra; j++) {
      code = (code << 6) | (bytes[i++]! & 0x3f);
    }
    if (code > 0xffff) {
      code -= 0x10000;
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out;
}
