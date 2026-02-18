import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Tidal Downloader Web",
        short_name: "Tidal DL",
        description:
            "Download music from Tidal in Hi-Res FLAC, MQA, and Dolby Atmos quality. Free web-based downloader — no installation required.",
        start_url: "/",
        display: "standalone",
        background_color: "#121212",
        theme_color: "#bb86fc",
        icons: [
            {
                src: "/favicon.ico",
                sizes: "any",
                type: "image/x-icon",
            },
        ],
        categories: ["music", "utilities"],
    };
}
