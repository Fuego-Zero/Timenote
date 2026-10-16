/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    "altcha-widget": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        auto?: string;
        challenge?: string;
        language?: string;
        type?: string;
        workers?: string;
    };
  }
}
