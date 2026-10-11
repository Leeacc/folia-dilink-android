// 当前文件：限制二维码请求等待时间，避免网络无响应时持续显示加载状态。
export const withLoginTimeout = async <T>(request: Promise<T>, timeoutMs = 15000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            request,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Music service request timed out')), timeoutMs);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
};
