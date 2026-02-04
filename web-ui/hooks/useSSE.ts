
import { useEffect, useState } from "react";

export function useSSE<T = unknown>(url: string) {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<Event | null>(null);
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
