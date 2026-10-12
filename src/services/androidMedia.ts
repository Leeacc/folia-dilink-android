import { isCapacitorAndroid } from '../platform/runtime';

// Android streams remote audio through a same-origin native handler (including range requests).
export function androidMediaUrl(source: string | null): string | undefined {
    if (!source) return undefined;
    if (!isCapacitorAndroid() || !/^https?:\/\//i.test(source)) return source;
    return `https://localhost/folia-media?url=${encodeURIComponent(source)}`;
}
