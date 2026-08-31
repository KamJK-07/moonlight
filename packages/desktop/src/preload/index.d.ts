import type { MoonlightBridge } from './index';

declare global {
  interface Window {
    moonlight: MoonlightBridge;
  }
}
