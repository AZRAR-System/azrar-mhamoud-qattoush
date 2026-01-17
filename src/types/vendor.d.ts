declare module 'docxtemplater' {
  type DocxtemplaterOptions = {
    paragraphLoop?: boolean;
    linebreaks?: boolean;
    delimiters?: { start: string; end: string };
    nullGetter?: () => string;
  };

  type DocxtemplaterInstance = {
    render: (data?: Record<string, unknown>) => void;
    getZip: () => {
      generate: (opts: Record<string, unknown>) => Uint8Array;
    };
  };

  const Docxtemplater: {
    new (zip: unknown, options?: DocxtemplaterOptions): DocxtemplaterInstance;
  };
  export default Docxtemplater;
}

declare module 'pizzip' {
  type PizZipInstance = {
    file: {
      (path: string): { asText: () => string } | null | undefined;
      (path: string, data: string): void;
    };
    generate: (opts: Record<string, unknown>) => Uint8Array;
  };

  const PizZip: {
    new (data?: Uint8Array | ArrayBuffer | string): PizZipInstance;
  };
  export default PizZip;
}

// Vite asset imports (e.g. pdf.worker.min.mjs?url)
declare module '*?url' {
  const url: string;
  export default url;
}

// PDF.js (pdfjs-dist) - we load these dynamically and cast to our own minimal runtime types.
declare module 'pdfjs-dist/build/pdf' {
  const pdfjs: unknown;
  export default pdfjs;
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const workerUrl: string;
  export default workerUrl;
}
