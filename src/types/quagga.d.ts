declare module 'quagga' {
  interface QuaggaResult {
    codeResult: {
      code: string;
      format: string;
    };
  }

  interface QuaggaConfig {
    inputStream: {
      name: string;
      type: string;
      target: HTMLElement | null;
      constraints?: {
        width?: number;
        height?: number;
        facingMode?: string;
      };
    };
    locator?: {
      patchSize?: string;
      halfSample?: boolean;
    };
    numOfWorkers?: number;
    decoder: {
      readers: string[];
    };
    locate?: boolean;
  }

  interface Quagga {
    init(config: QuaggaConfig, callback: (err: any) => void): void;
    start(): void;
    stop(): void;
    onDetected(callback: (result: QuaggaResult) => void): void;
    onProcessed(callback: (result: any) => void): void;
    offDetected(callback: (result: QuaggaResult) => void): void;
    offProcessed(callback: (result: any) => void): void;
  }

  const Quagga: Quagga;
  export default Quagga;
} 