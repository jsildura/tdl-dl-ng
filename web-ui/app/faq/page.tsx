import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "FAQ - Tidal Downloader Web",
    description:
        "Frequently asked questions about Tidal Downloader Web. Learn about pricing, Tidal subscription requirements, download quality, file locations, and audio fidelity.",
    alternates: {
        canonical: "/faq",
    },
};

const faqItems = [
    {
        question: "Is this tool free?",
        answer: "Yes, it is free to use.",
    },
    {
        question: "Do I need a Tidal subscription?",
        answer: "Yes, you need an active Tidal HiFi subscription.",
    },
    {
        question: "What quality does it download?",
        answer: "It downloads up to Hi-Res audio quality, depending on your subscription.",
    },
    {
        question: "Where are files saved?",
        answer: "Files are saved to your device's default download location.",
    },
    {
        question: "Is the downloaded audio quality the same as the source?",
        answer: "Yes, the files are decrypted directly from Tidal's servers and are bit-perfect copies of the source stream.",
    },
];

export default function FaqPage() {
    const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
            },
        })),
    };

    return (
        <div className="min-h-screen bg-background text-on-background p-4 md:p-8 font-roboto selection:bg-primary-container selection:text-on-primary-container">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
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
                    {faqItems.map((item, index) => (
                        <div key={index} className="space-y-2">
                            <h2 className="text-xl font-medium text-primary">{item.question}</h2>
                            <p className="text-on-surface-variant leading-relaxed">{item.answer}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
