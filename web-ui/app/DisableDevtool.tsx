"use client";

import { useEffect } from 'react';
import DisableDevtool from 'disable-devtool';

export default function DisableDevtoolComponent() {
    useEffect(() => {
        // checks if the environment is production or if the hostname is not localhost
        const isLocalhost = typeof window !== 'undefined' && (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname === '0.0.0.0'
        );

        if (!isLocalhost) {
            DisableDevtool({
                disableMenu: false,
                clearLog: true,
                disableSelect: false,
                disableCopy: false,
                disableCut: false,
                disablePaste: false
            });
        }
    }, []);

    return null;
}
