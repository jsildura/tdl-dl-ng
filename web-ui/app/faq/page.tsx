"use client";

import Link from "next/link";

export default function FaqPage() {
    return (
        <div className="min-h-screen bg-background text-on-background p-4 md:p-8 font-roboto selection:bg-primary-container selection:text-on-primary-container">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="flex items-center justify-between pb-6 border-b border-outline-variant/20">
                    <h1 className="text-3xl font-bold text-on-surface">FAQ</h1>
                    <Link
                        href="/"
                        className="text-sm font-medium text-primary hover:text-on-surface hover:bg-surface-container-highest px-4 py-2 rounded-full transition-colors duration-200"
                    >
                        Back to Dashboard
                    </Link>
                </header>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-xl font-medium text-primary">Is this tool free?</h2>
                        <p className="text-on-surface-variant leading-relaxed">Yes, it is free to use.</p>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-medium text-primary">Do I need a Tidal subscription?</h2>
                        <p className="text-on-surface-variant leading-relaxed">Yes, you need an active Tidal HiFi subscription.</p>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-medium text-primary">What quality does it download?</h2>
                        <p className="text-on-surface-variant leading-relaxed">It downloads up to Hi-Res audio quality, depending on your subscription.</p>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-medium text-primary">Where are files saved?</h2>
                        <p className="text-on-surface-variant leading-relaxed">Files are saved to your device's default download location.</p>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-medium text-primary">Is the downloaded audio quality the same as the source?</h2>
                        <p className="text-on-surface-variant leading-relaxed">Yes, the files are decrypted directly from Tidal's servers and are bit-perfect copies of the source stream.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
