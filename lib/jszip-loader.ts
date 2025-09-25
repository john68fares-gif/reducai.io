// Lazy, client-only loader for JSZip without using https: in an import.
// It injects a <script> tag at runtime and returns window.JSZip.
// Safe for Next.js SSR (no-ops on server).

let _p: Promise<any> | null = null;

export function loadJSZip(): Promise<any> {
  if (typeof window === 'undefined') {
    // SSR: return a never-resolving promise to avoid accidental server usage
    return new Promise(() => {});
  }
  if (_p) return _p;

  _p = new Promise((resolve, reject) => {
    // Already loaded?
    if ((window as any).JSZip) {
      resolve((window as any).JSZip);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    script.async = true;
    script.onload = () => {
      const JSZip = (window as any).JSZip;
      if (!JSZip) { reject(new Error('JSZip failed to load')); return; }
      resolve(JSZip);
    };
    script.onerror = () => reject(new Error('Failed to load JSZip script'));
    document.head.appendChild(script);
  });

  return _p;
}
