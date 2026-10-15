import { useState } from 'react';
import { carMedia } from '../../services/android/carMedia';
import { useTranslation } from 'react-i18next';
import { isCapacitorAndroid } from '../../platform/runtime';
import { useCarSettings } from '../../stores/useCarSettings';
import type { GestureFingers } from '../../stores/useCarSettings';

// Car-only controls stay alongside playback settings, not inside the lyrics renderer.
export default function CarPlaybackSettings() {
    const { t } = useTranslation();
    const preferences = useCarSettings();
    const [diagnostics, setDiagnostics] = useState('');
    if (!isCapacitorAndroid()) return null;
    return (
        <section className="space-y-4 p-5 rounded-2xl border border-white/10" data-car-settings>
            <h3 className="text-lg font-semibold">{t('car.title')}</h3>
            <p className="text-xs opacity-60">{t('car.systemHint')}</p>
            <label className="flex justify-between gap-4">
                <span>{t('car.immersive')}</span>
                <input
                    type="checkbox"
                    checked={preferences.immersive}
                    onChange={(event) => preferences.setPreference('immersive', event.target.checked)}
                />
            </label>
            {(['horizontalFingers', 'verticalFingers'] as const).map((key) => (
                <label key={key} className="flex justify-between gap-4 items-center">
                    <span>{t(key === 'horizontalFingers' ? 'car.horizontal' : 'car.vertical')}</span>
                    <select
                        aria-label={t(key === 'horizontalFingers' ? 'car.horizontal' : 'car.vertical')}
                        className="rounded-lg bg-zinc-800 text-white px-3 py-2"
                        value={preferences[key]}
                        onChange={(event) =>
                            preferences.setPreference(key, Number(event.target.value) as GestureFingers)
                        }
                    >
                        {[0, 1, 2, 3].map((value) => (
                            <option key={value} value={value}>
                                {value === 0 ? t('car.off') : t('car.fingers', { count: value })}
                            </option>
                        ))}
                    </select>
                </label>
            ))}
            <label className="flex justify-between gap-4">
                <span>{t('car.balanced')}</span>
                <input
                    type="checkbox"
                    checked={preferences.balancedGraphics}
                    onChange={(event) => preferences.setPreference('balancedGraphics', event.target.checked)}
                />
            </label>
            <p className="text-xs opacity-60">{t('car.gestureHint')}</p>
            <button
                type="button"
                className="px-3 py-2 rounded-lg bg-white/10"
                onClick={() =>
                    void carMedia
                        .diagnostics()
                        .then((value) => setDiagnostics(JSON.stringify(value, null, 2)))
                        .catch(() => setDiagnostics(t('car.diagnosticsFailed')))
                }
            >
                {t('car.diagnostics')}
            </button>
            {diagnostics && (
                <pre className="text-xs whitespace-pre-wrap select-text" data-car-no-gesture>
                    {diagnostics}
                </pre>
            )}
        </section>
    );
}
