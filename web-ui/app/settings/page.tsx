
"use client";

import { useEffect, useState } from "react";
import { getSettings, saveSettings, TidalSettings } from "@/lib/settings";
import { Save, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
    const [settings, setSettings] = useState<TidalSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        // Load settings from localStorage
        const loaded = getSettings();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSettings(loaded);
        setIsLoading(false);
    }, []);

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
        return <div className="p-8 text-center text-gray-400">Loading settings...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-white">Settings</h1>
                    <Link href="/" className="text-cyan-400 hover:underline">
                        Back to Dashboard
                    </Link>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-6">
                    <div className="grid gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                Audio Quality
                            </label>
                            <select
                                value={settings.quality_audio}
                                onChange={(e) => handleChange("quality_audio", e.target.value as TidalSettings['quality_audio'])}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            >
                                <option value="HI_RES_LOSSLESS">Hi-Res (24-bit)</option>
                                <option value="LOSSLESS">Lossless (CD Quality)</option>
                                <option value="HIGH">High (320kbps)</option>
                                <option value="LOW">Low (96kbps)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                Video Quality
                            </label>
                            <select
                                value={settings.quality_video}
                                onChange={(e) => handleChange("quality_video", e.target.value as TidalSettings['quality_video'])}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            >
                                <option value="1080">1080p</option>
                                <option value="720">720p</option>
                                <option value="480">480p</option>
                                <option value="360">360p</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                Cover Art Size
                            </label>
                            <select
                                value={settings.metadata_cover_dimension}
                                onChange={(e) => handleChange("metadata_cover_dimension", e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                            >
                                <option value="1280">1280x1280 (Original)</option>
                                <option value="640">640x640</option>
                                <option value="320">320x320</option>
                                <option value="160">160x160</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="lyrics_embed"
                                checked={settings.lyrics_embed}
                                onChange={(e) => handleChange("lyrics_embed", e.target.checked)}
                                className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-cyan-500 focus:ring-cyan-500"
                            />
                            <label htmlFor="lyrics_embed" className="text-sm text-gray-300">
                                Embed lyrics in downloaded files
                            </label>
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="metadata_cover_embed"
                                checked={settings.metadata_cover_embed}
                                onChange={(e) => handleChange("metadata_cover_embed", e.target.checked)}
                                className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-cyan-500 focus:ring-cyan-500"
                            />
                            <label htmlFor="metadata_cover_embed" className="text-sm text-gray-300">
                                Embed cover art in downloaded files
                            </label>
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="skip_existing"
                                checked={settings.skip_existing}
                                onChange={(e) => handleChange("skip_existing", e.target.checked)}
                                className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-cyan-500 focus:ring-cyan-500"
                            />
                            <label htmlFor="skip_existing" className="text-sm text-gray-300">
                                Skip downloading existing files
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white font-medium transition disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>

                        {saveSuccess && (
                            <span className="flex items-center gap-1 text-green-400 text-sm">
                                <CheckCircle className="w-4 h-4" />
                                Saved to browser
                            </span>
                        )}
                    </div>

                    <p className="text-xs text-gray-500">
                        Settings are stored locally in your browser. They will persist even after closing the browser.
                    </p>
                </div>
            </div>
        </div>
    );
}
