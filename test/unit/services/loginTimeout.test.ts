import { afterEach, describe, expect, it, vi } from 'vitest';
import { withLoginTimeout } from '@/services/onlineMusic/loginTimeout';

// 当前文件：验证网络卡住时退出加载状态，并清除成功和失败请求的计时器。
afterEach(() => vi.useRealTimers());
describe('login request deadline', () => {
  it('times out a service that never responds', async () => {
    vi.useFakeTimers();
    const result = expect(withLoginTimeout(new Promise(() => {}), 15000)).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves successful responses and clears the deadline', async () => {
    vi.useFakeTimers();
    await expect(withLoginTimeout(Promise.resolve({ key: 'test' }))).resolves.toEqual({ key: 'test' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves service failures without waiting for the deadline', async () => {
    vi.useFakeTimers();
    await expect(withLoginTimeout(Promise.reject(new Error('offline')))).rejects.toThrow('offline');
    expect(vi.getTimerCount()).toBe(0);
  });
});
