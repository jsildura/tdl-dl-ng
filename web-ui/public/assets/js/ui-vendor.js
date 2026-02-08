// Aggressive Anti-AdBlock
(function () {
    const AdBlockGuard = {
        /**
         * Configuration Constants
         * Defines CSS classes, IDs, styles, and timing intervals.
         */
        config: {
            checkInterval: 2000,
            ids: {
                baitGeneric: 'ad-detection-bait', // Generic bait ID
                baitAdsense: 'ad-detection-bait-ins', // Unique ID for our specific AdSense bait
                modalPrefix: 'anti-adblock-', // Prefix for modal IDs
                watchedAdContainers: [] // OPTIONAL: User-defined IDs of legitimate ad containers to monitor. E.g. ['ad-header', 'ad-sidebar', 'ad-bottom']
            },
            classes: {
                // A mix of common ad-related classes to trigger generic blockers
                baitGeneric: "ad-banner adsbygoogle ad-unit advertisement adbox sponsored-ad pub_300x250 pub_728x90 text-ad ads ad doubleclick",
                baitAdsense: "adsbygoogle",
                baitAdsensePermittedPrefix: "adsbygoogle-"
            },
            styles: {
                // Inline styles with !important to prevent external CSS overriding
                bait: "display: block !important; visibility: visible !important; opacity: 1 !important; height: 1px !important; width: 1px !important; position: absolute !important; left: -10000px !important; top: -10000px !important; background-color: transparent !important; pointer-events: none !important;",
                modalWrapper: `
                    position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important;
                    height: 100% !important; background: rgba(0, 0, 0, 0.7) !important;
                    color: #ffffff !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                    z-index: 99999 !important; display: flex !important; align-items: center !important;
                    justify-content: center !important; flex-direction: column !important;
                    backdrop-filter: blur(8px) !important;
                `,
                modalContent: `
                    max-width: 420px !important; width: 90% !important; padding: 40px 30px !important; 
                    background: #1a1d29 !important;
                    border-radius: 16px !important; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
                    text-align: center !important;
                `
            }
        },

        state: {
            warningActive: false,
            elements: {
                baitGeneric: null,
                baitAdsense: null
            }
        },

        init() {
            // Kickstart the detection process
            this.runInitialChecks();
            this.startLoop();
            this.bindEvents();
            this.startIframeMonitor();
        },

        // --- DOM Management ---

        /**
         * Creates or retrieves the 'bait' elements.
         * These are invisible elements with ad-like classes designed to be hidden by blockers.
         */
        createBaits() {
            // 1. Generic Bait (Standard ad classes)
            this.state.elements.baitGeneric = document.getElementById(this.config.ids.baitGeneric);
            if (!this.state.elements.baitGeneric) {
                this.state.elements.baitGeneric = document.createElement("div");
                this.state.elements.baitGeneric.id = this.config.ids.baitGeneric;
                this.state.elements.baitGeneric.className = this.config.classes.baitGeneric;
                this.state.elements.baitGeneric.style = this.config.styles.bait;
                document.body.appendChild(this.state.elements.baitGeneric);
            }

            // 2. AdSense Bait (Mimics an AdSense <ins> tag)
            // Uses a specific ID to avoid confusing legitimate ads on the page
            this.state.elements.baitAdsense = document.getElementById(this.config.ids.baitAdsense);
            if (!this.state.elements.baitAdsense) {
                this.state.elements.baitAdsense = document.createElement("ins");
                this.state.elements.baitAdsense.id = this.config.ids.baitAdsense;
                this.state.elements.baitAdsense.className = this.config.classes.baitAdsense;
                this.state.elements.baitAdsense.style = this.config.styles.bait;
                document.body.appendChild(this.state.elements.baitAdsense);
            }
        },

        /**
         * Refreshes baits by moving them in the DOM.
         * This forces the browser (and extensions) to re-evaluate CSS rules,
         * catching blockers that might have missed the initial load or are in a dormant state.
         */
        refreshBaits() {
            if (this.state.warningActive) return;

            ['baitGeneric', 'baitAdsense'].forEach(key => {
                const el = this.state.elements[key];
                if (el && el.isConnected) {
                    // Re-appending an existing node moves it to the end, triggering a style recalc
                    document.body.appendChild(el);
                } else {
                    this.createBaits(); // Re-create if missing
                }
            });
        },

        // --- UI (Warning Modal) ---
        generateUniqueId() {
            // Random ID to prevent static CSS rules from hiding the modal
            return this.config.ids.modalPrefix + Math.random().toString(36).substr(2, 9);
        },

        createWarningModal() {
            if (this.state.warningActive) return;

            // Check if a modal already exists (even if tracked state says otherwise)
            let existingModal = document.querySelector(`[id^='${this.config.ids.modalPrefix}']`);
            if (existingModal) {
                this.restoreModalStyles(existingModal);
                this.state.warningActive = true;
                return;
            }

            // Create new modal
            const modalId = this.generateUniqueId();
            const modal = document.createElement("div");
            modal.id = modalId;
            modal.style = this.config.styles.modalWrapper;

            const modalContent = document.createElement("div");
            modalContent.style = this.config.styles.modalContent;

            // Shield icon with slash
            const iconContainer = document.createElement("div");
            iconContainer.style = "margin-bottom: 24px; display: flex; justify-content: center;";
            iconContainer.innerHTML = `
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2Z" stroke="#e74c3c" stroke-width="2" fill="none"/>
                    <line x1="6" y1="18" x2="18" y2="6" stroke="#e74c3c" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `;

            // Title
            const title = document.createElement("h2");
            title.textContent = "Oops! Something's blocking the ads";
            title.style = "color: #ffffff !important; font-size: 20px !important; font-weight: 600 !important; margin: 0 0 12px 0 !important;";

            // Message
            const message = document.createElement("p");
            message.textContent = "Ads keep us free. Please disable your blocker to continue.";
            message.style = "color: #9ca3af !important; font-size: 14px !important; margin: 0 0 28px 0 !important; line-height: 1.5 !important;";

            // Reload button
            const reloadButton = document.createElement("button");
            reloadButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 8px;">
                    <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
                    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
                </svg>
                I've Disabled It - Refresh
            `;
            reloadButton.style = `
                display: flex !important; 
                align-items: center !important;
                justify-content: center !important;
                background: #2d3748 !important; 
                color: #ffffff !important;
                border: 1px solid #4a5568 !important; 
                padding: 14px 28px !important; 
                font-size: 14px !important;
                font-weight: 500 !important;
                cursor: pointer !important; 
                border-radius: 8px !important;
                width: 100% !important;
                transition: background 0.2s !important;
            `;
            reloadButton.onmouseover = () => reloadButton.style.background = "#3d4a5c";
            reloadButton.onmouseout = () => reloadButton.style.background = "#2d3748";
            reloadButton.addEventListener("click", () => location.reload());

            modalContent.appendChild(iconContainer);
            modalContent.appendChild(title);
            modalContent.appendChild(message);
            modalContent.appendChild(reloadButton);
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            this.state.warningActive = true;
        },

        restoreModalStyles(modal) {
            /**
             * Aggressive Persistence Mechanism.
             * Executed every check cycle to ensure the modal cannot be hidden or tampered with.
             */

            // 1. Rotate ID: Prevents users from writing static CSS
            modal.id = this.generateUniqueId();

            // 2. Force Styles: Overwrites 'style' attribute with the secure config string.
            // This undoes any manual tampering via Inspector (opacity, visibility, z-index).
            modal.style.cssText = this.config.styles.modalWrapper;

            // 3. Clip-Path Protection: Ensures the modal isn't hidden via clipping.
            modal.style.clipPath = "none";
        },

        // --- Detection Logic ---
        isBlocked(element) {
            if (!element) return true;
            if (element.offsetHeight === 0 || element.offsetWidth === 0) return true;
            const style = getComputedStyle(element);
            return style.display === "none" || style.visibility === "hidden" || style.opacity === "0";
        },

        checkState() {
            // 1. If Warning is Active: Enforce Persistence
            if (this.state.warningActive) {
                const modal = document.querySelector(`[id^='${this.config.ids.modalPrefix}']`);
                if (modal) {
                    this.restoreModalStyles(modal);
                } else {
                    // Modal was deleted from DOM. Recreate immediately.
                    this.state.warningActive = false;
                    this.createWarningModal();
                }
                return; // Stop checks, we are already blocking.
            }

            // 2. Ensure Baits are present
            this.createBaits();

            let detected = false;

            // Check Method A: Generic Bait Visibility
            if (this.isBlocked(this.state.elements.baitGeneric)) {
                detected = true;
            }

            // Check Method B: AdSense Manipulation (Scanning ALL ads)
            // Some blockers add classes or titles to <ins> elements instead of hiding them.
            const allAdElements = document.querySelectorAll(`ins.${this.config.classes.baitAdsense}`);
            for (const ad of allAdElements) {
                const classNames = Array.from(ad.classList);
                // Detect unauthorized classes (anything not "adsbygoogle" or "adsbygoogle-xxx")
                const hasSuspiciousClass = classNames.some(cls =>
                    cls !== this.config.classes.baitAdsense &&
                    !cls.startsWith(this.config.classes.baitAdsensePermittedPrefix)
                );

                if (hasSuspiciousClass || ad.hasAttribute("title")) {
                    detected = true;
                    break;
                }
            }

            // Check Method C: User-defined Ad Containers
            if (this.config.ids.watchedAdContainers && Array.isArray(this.config.ids.watchedAdContainers)) {
                for (const containerId of this.config.ids.watchedAdContainers) {
                    const el = document.getElementById(containerId);
                    if (!el || this.isBlocked(el)) {
                        detected = true;
                        break;
                    }
                }
            }

            // Check Method D: Network Block (External Script Failure) - Primary Check
            if (window.isAdScriptBlocked === true) {
                detected = true;
            }

            // Check Method E: Active Network Probe (Script element approach)
            // Script elements throw errors when blocked, unlike fetch with no-cors
            if (!window._adBlockProbeRan) {
                window._adBlockProbeRan = true;
                window._adBlockProbeLoaded = false;
                window._adBlockProbeError = false;

                const probeScript = document.createElement('script');
                probeScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?t=' + Date.now();
                probeScript.async = true;
                probeScript.onerror = () => {
                    window._adBlockProbeError = true;
                    this.createWarningModal();
                };
                probeScript.onload = () => {
                    window._adBlockProbeLoaded = true;
                };
                document.head.appendChild(probeScript);

                // Timeout fallback for Brave Shields (doesn't always fire onerror)
                // Only trigger if neither onload nor onerror fired
                setTimeout(() => {
                    if (!window._adBlockProbeLoaded && !window._adBlockProbeError && !this.state.warningActive) {
                        this.createWarningModal();
                    }
                }, 3000);
            }

            if (detected) {
                console.log('[Anti-AdBlock] AdBlocker detected!');
                this.createWarningModal();
            } else {
                // console.log('[Anti-AdBlock] No blocker detected.');
            }
        },

        // --- Main Loop & Events ---

        runInitialChecks() {
            this.checkState();
            // A burst of checks to catch race conditions during page load
            [100, 500, 1000, 2000].forEach(delay =>
                setTimeout(() => this.checkState(), delay)
            );
        },

        startLoop() {
            let cycles = 0;
            const AGGRESSIVE_LIMIT = 30; // Limit aggressive refresh to first ~60 seconds (30 * 2000ms)

            setInterval(() => {
                this.checkState();

                // COOL-DOWN MECHANISM:
                // Only refresh baits aggressively for the first phase.
                // Afterward, rely on passive monitoring (checkState) to save client CPU.
                if (!this.state.warningActive && cycles < AGGRESSIVE_LIMIT) {
                    this.refreshBaits();
                    cycles++;
                }
            }, this.config.checkInterval);

            // Reactivate aggressive monitoring if user returns to the tab
            document.addEventListener("visibilitychange", () => {
                if (!document.hidden) {
                    this.checkState();
                    cycles = 0; // Reset counter
                }
            });
        },

        bindEvents() {
            // BFCache support (Back/Forward navigation)
            window.addEventListener('pageshow', (event) => {
                if (event.persisted) this.checkState();
            });
            window.addEventListener('load', () => {
                setTimeout(() => this.checkState(), 100);
            });
        },

        /**
         * Iframe Monitor (MutationObserver)
         * Watches for changes in iframes injected by ad networks.
         * Detects forced dimensions (1px !important) often triggered by cosmetic filters.
         */
        startIframeMonitor() {
            const RULES = [
                /height\s*:\s*1px\s*!important/i,
                /width\s*:\s*1px\s*!important/i,
                /max-height\s*:\s*1px\s*!important/i,
                /max-width\s*:\s*1px\s*!important/i
            ];

            let iframeDetected = false;

            const check = () => {
                if (iframeDetected) return;
                const iframes = document.querySelectorAll('ins iframe[id^="aswift_"]');
                for (const iframe of iframes) {
                    const style = iframe.getAttribute('style');
                    if (!style) continue;

                    let count = 0;
                    for (const r of RULES) {
                        if (r.test(style)) count++;
                    }
                    if (count >= 2) {
                        iframeDetected = true;
                        this.createWarningModal();
                        try { observer.disconnect(); } catch { }
                        break;
                    }
                }
            };

            const observer = new MutationObserver((mutations) => {
                let shouldCheck = false;
                for (const m of mutations) {
                    if (m.type === 'childList') shouldCheck = true;
                    else if (m.type === 'attributes' && (m.target.tagName === 'IFRAME' || m.target.tagName === 'INS')) shouldCheck = true;
                }
                if (shouldCheck) check();
            });

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style']
            });

            setInterval(check, 3500); // Auxiliary polling for iframes
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => AdBlockGuard.init());
    } else {
        AdBlockGuard.init();
    }
})();
