
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSettings, saveSettings, TidalSettings } from "@/lib/settings";
import { isAuthenticated } from "@/lib/auth";
import { Save, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
    const router = useRouter();
    const [settings, setSettings] = useState<TidalSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        // Check if user is authenticated
        if (!isAuthenticated()) {
            alert('Please login to access settings.');
            router.push('/login');
            return;
        }

        // Load settings from localStorage
        const loaded = getSettings();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSettings(loaded);
        setIsLoading(false);
    }, [router]);

    const handleChange = (key: keyof TidalSettings, value: string | boolean) => {
        setSettings((prev) => prev ? { ...prev, [key]: value } : null);
        setSaveSuccess(false);
    };

    const handleSave = () => {
        if (!settings) return;

        setIsSaving(true);
        try {
            saveSettings(settings);
            setSaveSuccess(true);
            console.log("Settings saved to localStorage:", settings);
        } catch (error) {
            console.error("Failed to save settings:", error);
            alert("Failed to save settings.");
        }
        setIsSaving(false);
    };

    if (isLoading || !settings) {
        return <div className="p-8 text-center text-on-surface-variant animate-pulse">Loading settings...</div>;
    }

    return (
        <div className="min-h-screen bg-background text-on-background p-4 md:p-6 font-roboto selection:bg-primary-container selection:text-on-primary-container">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h1 className="text-3xl font-normal tracking-tight text-on-surface">Settings</h1>
                    <Link
                        href="/"
                        className="text-sm font-medium text-primary hover:text-on-surface hover:bg-surface-container-highest px-4 py-2 rounded-full transition-colors duration-200"
                    >
                        Back to Dashboard
                    </Link>
                </div>

                <div className="bg-surface-container rounded-3xl p-5 md:p-6 shadow-sm space-y-6">
                    <div className="grid gap-5">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-on-surface-variant ml-1">
                                Audio Quality
                            </label>
                            <div className="relative">
                                <select
                                    value={settings.quality_audio}
                                    onChange={(e) => handleChange("quality_audio", e.target.value as TidalSettings['quality_audio'])}
                                    className="w-full appearance-none bg-surface-container-high text-on-surface rounded-xl px-3 py-2.5 pr-10 border-none outline-none ring-1 ring-transparent focus:ring-2 focus:ring-primary transition-all duration-200 cursor-pointer text-sm"
                                >
                                    <option value="HI_RES_LOSSLESS">Hi-Res (24-bit)</option>
                                    <option value="LOSSLESS">Lossless (CD Quality)</option>
                                    <option value="HIGH">High (320kbps)</option>
                                    <option value="LOW">Low (96kbps)</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant">
                                    <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-on-surface-variant ml-1">
                                Video Quality
                            </label>
                            <div className="relative">
                                <select
                                    value={settings.quality_video}
                                    onChange={(e) => handleChange("quality_video", e.target.value as TidalSettings['quality_video'])}
                                    className="w-full appearance-none bg-surface-container-high text-on-surface rounded-xl px-3 py-2.5 pr-10 border-none outline-none ring-1 ring-transparent focus:ring-2 focus:ring-primary transition-all duration-200 cursor-pointer text-sm"
                                >
                                    <option value="1080">1080p</option>
                                    <option value="720">720p</option>
                                    <option value="480">480p</option>
                                    <option value="360">360p</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant">
                                    <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-on-surface-variant ml-1">
                                Cover Art Size
                            </label>
                            <div className="relative">
                                <select
                                    value={settings.metadata_cover_dimension}
                                    onChange={(e) => handleChange("metadata_cover_dimension", e.target.value)}
                                    className="w-full appearance-none bg-surface-container-high text-on-surface rounded-xl px-3 py-2.5 pr-10 border-none outline-none ring-1 ring-transparent focus:ring-2 focus:ring-primary transition-all duration-200 cursor-pointer text-sm"
                                >
                                    <option value="1280">1280x1280 (Original)</option>
                                    <option value="640">640x640</option>
                                    <option value="320">320x320</option>
                                    <option value="160">160x160</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant">
                                    <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 pt-1">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.lyrics_embed}
                                        onChange={(e) => handleChange("lyrics_embed", e.target.checked)}
                                        className="peer h-4.5 w-4.5 cursor-pointer appearance-none rounded-md border-2 border-on-surface-variant transition-all checked:border-primary checked:bg-primary hover:border-primary focus:ring-2 focus:ring-primary/20"
                                    />
                                    <CheckCircle className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-on-primary opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                </div>
                                <span className="text-sm text-on-surface group-hover:text-primary transition-colors">
                                    Embed lyrics in downloaded files
                                </span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.metadata_cover_embed}
                                        onChange={(e) => handleChange("metadata_cover_embed", e.target.checked)}
                                        className="peer h-4.5 w-4.5 cursor-pointer appearance-none rounded-md border-2 border-on-surface-variant transition-all checked:border-primary checked:bg-primary hover:border-primary focus:ring-2 focus:ring-primary/20"
                                    />
                                    <CheckCircle className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-on-primary opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                </div>
                                <span className="text-sm text-on-surface group-hover:text-primary transition-colors">
                                    Embed cover art in downloaded files
                                </span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.skip_existing}
                                        onChange={(e) => handleChange("skip_existing", e.target.checked)}
                                        className="peer h-4.5 w-4.5 cursor-pointer appearance-none rounded-md border-2 border-on-surface-variant transition-all checked:border-primary checked:bg-primary hover:border-primary focus:ring-2 focus:ring-primary/20"
                                    />
                                    <CheckCircle className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-on-primary opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                </div>
                                <span className="text-sm text-on-surface group-hover:text-primary transition-colors">
                                    Skip downloading existing files
                                </span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={settings.multi_thread_download}
                                        onChange={(e) => handleChange("multi_thread_download", e.target.checked)}
                                        className="peer h-4.5 w-4.5 cursor-pointer appearance-none rounded-md border-2 border-on-surface-variant transition-all checked:border-primary checked:bg-primary hover:border-primary focus:ring-2 focus:ring-primary/20"
                                    />
                                    <CheckCircle className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-on-primary opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm text-on-surface group-hover:text-primary transition-colors">
                                        Multi-thread download (faster)
                                    </span>
                                    <span className="text-xs text-on-surface-variant/60">
                                        Downloads segments in parallel. Adds 5s delay between tracks to prevent rate limiting.
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-full hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:bg-surface-container-highest disabled:text-on-surface-variant/38 transition-all font-medium text-sm active:scale-95"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>

                        {saveSuccess && (
                            <span className="flex items-center gap-2 text-green-400 text-sm font-medium animate-in fade-in slide-in-from-left-2">
                                <CheckCircle className="w-4 h-4" />
                                Saved to browser
                            </span>
                        )}
                    </div>

                    <p className="text-xs text-on-surface-variant/60 pt-4 border-t border-outline-variant/20">
                        Settings are stored locally in your browser. They will persist even after closing the browser.
                    </p>
                </div>
            </div>
        </div>
    );
}
