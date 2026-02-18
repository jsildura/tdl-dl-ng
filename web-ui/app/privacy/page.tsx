import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description:
        "Privacy Policy for Tidal Downloader Web. Learn how we handle your data, what information is collected, and how it is used.",
    alternates: {
        canonical: "/privacy",
    },
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background text-on-background p-4 md:p-8 font-roboto selection:bg-primary-container selection:text-on-primary-container">
            <div className="max-w-3xl mx-auto space-y-8">
                <header className="flex items-center justify-between pb-6 border-b border-outline-variant/20">
                    <h1 className="text-3xl font-bold text-on-surface">Privacy Policy</h1>
                    <Link
                        href="/"
                        className="text-sm font-medium text-primary hover:text-on-surface hover:bg-surface-container-highest px-4 py-2 rounded-full transition-colors duration-200"
                    >
                        Back to Dashboard
                    </Link>
                </header>

                <div className="space-y-6 text-on-surface-variant leading-relaxed">

                    <section className="space-y-2">
                        <h2 className="text-xl font-medium text-primary">Overview</h2>
                        <p>
                            Tidal Downloader Web (&quot;we&quot;, &quot;our&quot;, or &quot;the service&quot;) respects your privacy. This policy explains what information we collect, how we use it, and your rights regarding your data.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-xl font-medium text-primary">Information We Collect</h2>
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong>Tidal Credentials</strong> — Your Tidal session token is used solely to authenticate downloads. We do not store your Tidal password.</li>
                            <li><strong>Download History</strong> — A record of downloaded tracks, albums, and playlists is stored to display your recent activity.</li>
                            <li><strong>Usage Statistics</strong> — Download counts are tracked for display purposes only.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-xl font-medium text-primary">How We Use Your Information</h2>
                        <ul className="list-disc list-inside space-y-1">
                            <li>To authenticate and process your download requests.</li>
                            <li>To display your recent download history.</li>
                            <li>To show aggregate download statistics.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-xl font-medium text-primary">Third-Party Services</h2>
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong>Tidal</strong> — We interact with Tidal&apos;s API to fetch and download content. Your use is subject to Tidal&apos;s own privacy policy.</li>
                            <li><strong>Advertising</strong> — We may display third-party ads. Ad providers may collect anonymized usage data.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-xl font-medium text-primary">Cookies</h2>
                        <p>
                            We use local storage and cookies to maintain your session and preferences. No tracking cookies are used for profiling purposes.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-xl font-medium text-primary">Your Rights</h2>
                        <p>
                            You may clear your download history at any time. You can log out to remove your session data. All downloaded files remain on your device under your control.
                        </p>
                    </section>

                </div>
            </div>
        </div>
    );
}
