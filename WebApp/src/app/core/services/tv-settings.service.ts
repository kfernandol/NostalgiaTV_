import { Injectable, signal } from '@angular/core';

export interface VideoFilterProfile {
    scanlineIntensity: number;
    scanlineDensity: number;
    crtCurvature: boolean;
    vignette: boolean;
}

export interface TvSettings {
    alwaysShowFilters: boolean;
    showBumpers: boolean;
    showAds: boolean;
    tvGlowEffect: boolean;
    includeMovies: boolean;
    includeSpecials: boolean;
    randomPlayback: boolean;
    filters: VideoFilterProfile;
    filtersFullscreen: VideoFilterProfile;
}

const DEFAULT_FILTER: VideoFilterProfile = {
    scanlineIntensity: 25,
    scanlineDensity: 2,
    crtCurvature: true,
    vignette: true,
};

const DEFAULT_FILTER_FULLSCREEN: VideoFilterProfile = {
    scanlineIntensity: 60,
    scanlineDensity: 2,
    crtCurvature: true,
    vignette: true,
};

const STORAGE_KEY = 'nostalgia_tv_settings';

const DEFAULT_SETTINGS: TvSettings = {
    alwaysShowFilters: false,
    showBumpers: false,
    showAds: false,
    tvGlowEffect: true,
    includeMovies: true,
    includeSpecials: true,
    randomPlayback: false,
    filters: { ...DEFAULT_FILTER },
    filtersFullscreen: { ...DEFAULT_FILTER_FULLSCREEN },
};

@Injectable({ providedIn: 'root' })
export class TvSettingsService {
    private _settings = signal<TvSettings>(this.load());
    readonly settings = this._settings.asReadonly();

    private load(): TvSettings {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    }

    update(patch: Partial<TvSettings>): void {
        const updated = { ...this._settings(), ...patch };
        this._settings.set(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }

    updateFilter(patch: Partial<VideoFilterProfile>, fullscreen: boolean): void {
        const key = fullscreen ? 'filtersFullscreen' : 'filters';
        const updated = { ...this._settings(), [key]: { ...this._settings()[key], ...patch } };
        this._settings.set(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
}
