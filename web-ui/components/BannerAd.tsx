"use client";

import { useEffect, useRef } from 'react';

export default function BannerAd() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Clear previous content
        container.innerHTML = '';

        // Create an iframe
        const iframe = document.createElement('iframe');
        iframe.style.border = '0';
        iframe.style.width = '468px';
        iframe.style.height = '60px';
        iframe.style.maxWidth = '100%';
        iframe.style.overflow = 'hidden';
        iframe.title = "Advertisement";

        container.appendChild(iframe);

        // content to write into the iframe
        const adContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;justify-content:center;align-items:center;height:100%;}</style>
      </head>
      <body>
        <script type="text/javascript">
          atOptions = {
            'key' : 'de64f65de09becfdf55ba48eace1197a',
            'format' : 'iframe',
            'height' : 60,
            'width' : 468,
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="//www.highperformanceformat.com/de64f65de09becfdf55ba48eace1197a/invoke.js"></script>
      </body>
      </html>
    `;

        // Write content to the iframe
        try {
            const doc = iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(adContent);
                doc.close();
            }
        } catch (e) {
            console.error("Error loading banner ad:", e);
        }

        return () => {
            if (container) {
                container.innerHTML = '';
            }
        };
    }, []);

    return (
        <div className="flex flex-col items-center w-full mb-6">
            <div className="w-[468px] max-w-full flex justify-start mb-1">
                <span className="text-[10px] text-on-surface-variant/40 uppercase tracking-widest">Sponsored</span>
            </div>
            <div
                ref={containerRef}
                className="w-[468px] h-[60px] bg-surface-container-high/10 rounded-md overflow-hidden flex items-center justify-center"
                style={{ maxWidth: '100%' }}
            />
        </div>
    );
}
