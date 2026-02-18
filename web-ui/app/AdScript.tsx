"use client";

import Script from "next/script";

export default function AdScript() {
    return (
        <>
            {/* Navigation guard: prevent ad scripts from redirecting the main page */}
            <Script
                id="redirect-guard"
                strategy="beforeInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
                        (function() {
                            var origLocation = window.location;
                            var currentHost = origLocation.hostname;
                            
                            // Block programmatic navigation to external URLs
                            var origAssign = origLocation.assign.bind(origLocation);
                            var origReplace = origLocation.replace.bind(origLocation);
                            
                            origLocation.assign = function(url) {
                                try {
                                    var u = new URL(url, origLocation.href);
                                    if (u.hostname === currentHost) return origAssign(url);
                                } catch(e) {}
                                console.warn('[RedirectGuard] Blocked redirect to:', url);
                            };
                            
                            origLocation.replace = function(url) {
                                try {
                                    var u = new URL(url, origLocation.href);
                                    if (u.hostname === currentHost) return origReplace(url);
                                } catch(e) {}
                                console.warn('[RedirectGuard] Blocked redirect to:', url);
                            };
                        })();
                    `
                }}
            />
            <Script
                src="https://pl28650855.effectivegatecpm.com/5d/3f/6c/5d3f6cd061b197396c5d98f803d627a2.js"
                strategy="afterInteractive"
            />
            <Script
                src="/assets/js/ui-vendor.js"
                strategy="lazyOnload"
            />
        </>
    );
}
