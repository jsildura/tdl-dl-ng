"use client";

import Script from "next/script";

export default function AdScript() {
    return (
        <>
            <Script
                src="https://pl28650855.effectivegatecpm.com/5d/3f/6c/5d3f6cd061b197396c5d98f803d627a2.js"
                strategy="beforeInteractive"
            />
            <Script
                src="/assets/js/ui-vendor.js"
                strategy="afterInteractive"
            />
        </>
    );
}
