declare module 'nosleep.js' {
  export default class NoSleep {
    constructor();
    enable(): Promise<void>;
    disable(): void;
    get isEnabled(): boolean;
  }
} 