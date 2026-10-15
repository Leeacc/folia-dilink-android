import { registerPlugin } from '@capacitor/core';
import { isCapacitorAndroid } from '../platform/runtime';

// 当前文件：Android 页面通过原生桥调用包内音乐服务，不依赖外部部署或浏览器跨域。
const embedded = registerPlugin<{
  request(input: { provider: 'netease' | 'kugou' | 'qq'; endpoint: string }): Promise<{ data: any }>;
}>('EmbeddedMusic');

export const hasEmbeddedMusic = isCapacitorAndroid;
export const requestEmbeddedMusic = async (provider: 'netease' | 'kugou' | 'qq', endpoint: string): Promise<any> => {
  const result = await embedded.request({ provider, endpoint });
  return result.data;
};
