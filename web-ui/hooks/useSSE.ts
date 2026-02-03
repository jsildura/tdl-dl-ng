
import { useEffect, useState } from "react";

export function useSSE(url: string) {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<any>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const eventSource = new EventSource(url);

        eventSource.onopen = () => {
            setConnected(true);
            setError(null);
        };

        eventSource.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                setData(parsed);
            } catch (e) {
                console.error("SSE parse error", e);
            }
        };

        eventSource.onerror = (e) => {
            setError(e);
            setConnected(false);
            eventSource.close();
            // Optional: Logic to reconnect
        };

        return () => {
            eventSource.close();
        };
    }, [url]);

    return { data, connected, error };
}
