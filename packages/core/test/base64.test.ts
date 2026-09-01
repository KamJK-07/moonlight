import { utf8ToBase64, base64ToUtf8 } from '../src/base64';

describe('utf8ToBase64 / base64ToUtf8', () => {
  it('round-trips ASCII', () => {
    const s = 'hello world';
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
  });

  it('round-trips a string with emoji', () => {
    const s = 'sync your data 🚀🔥📦';
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
  });

  it('round-trips a string with CJK characters', () => {
    const s = '同步你的数据 こんにちは 안녕하세요';
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
  });

  it('round-trips the empty string', () => {
    const s = '';
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
  });

  it('round-trips a JSON.stringify of an object containing all of the above', () => {
    const s = JSON.stringify({
      ascii: 'hello world',
      emoji: 'sync your data 🚀🔥📦',
      cjk: '同步你的数据 こんにちは 안녕하세요',
      empty: '',
    });
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
  });
});
