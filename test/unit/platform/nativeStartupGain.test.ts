// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from 'vitest';

// Upgrading must not unmute a silent player or restore the old full-gain startup fault.
vi.mock('@/platform/runtime', () => ({isCapacitorAndroid: () => true}));
beforeEach(() => {localStorage.clear();vi.resetModules();});
describe('native startup gain migration', () => {
    it.each([[null,0.2],['0',0],['1',0.2],['broken',0.2]] as const)('migrates previous gain %s safely', async (saved,expected) => {
        if(saved!==null)localStorage.setItem('player_volume',saved);
        const {useAudioSettingsStore}=await import('@/stores/useAudioSettingsStore');
        expect(useAudioSettingsStore.getState().volume).toBe(expected);
    });
    it('preserves a chosen gain after the one-time migration', async () => {
        localStorage.setItem('player_volume','0.7');localStorage.setItem('car_native_gain_v1','true');
        const {useAudioSettingsStore}=await import('@/stores/useAudioSettingsStore');
        expect(useAudioSettingsStore.getState().volume).toBe(0.7);
    });
});
