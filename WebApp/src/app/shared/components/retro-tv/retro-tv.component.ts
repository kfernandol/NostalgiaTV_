import {
  Component,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';
import * as signalR from '@microsoft/signalr';
import { TvSettingsService } from '../../../core/services/tv-settings.service';
import { WatchedService } from '../../../core/services/watched.service';
import { SeriesResponse } from '../../models/serie.model';

interface Channel {
  id: number;
  name: string;
  logoPath?: string;
}
interface ChannelState {
  channelId: number;
  episodeId: number;
  episodeTitle: string;
  filePath: string;
  seriesName: string;
  seriesLogoPath?: string;
  currentSecond: number;
  nextEpisodeId: number;
  nextEpisodeTitle: string | null;
  secondsUntilNext: number;
}
interface EpisodeType {
  id: number;
  name: string;
}
interface EpisodeResponse {
  id: number;
  title: string;
  filePath?: string;
  season: number;
  episodeNumber: number;
  episodeTypeId: number;
  episodeTypeName: string;
  seriesId: number;
}
interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type AppMode = 'channels' | 'series';

interface ScheduleEntry {
  id: number;
  channelId: number;
  episodeId: number;
  episodeTitle: string;
  seriesName: string;
  seriesLogoPath?: string;
  filePath: string;
  startTime: string;
  endTime: string;
  season: number;
  episodeNumber: number;
}

@Component({
  selector: 'app-retro-tv',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  standalone: true,
  templateUrl: './retro-tv.component.html',
  styleUrl: './retro-tv.component.scss',
})
export class RetroTvComponent implements AfterViewInit, OnDestroy {
  @ViewChild('tvContainer') tvContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('screenOverlay') screenOverlay!: ElementRef<HTMLDivElement>;
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoFilters') videoFilters!: ElementRef<HTMLDivElement>;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private tvSettings = inject(TvSettingsService);
  private watchedService = inject(WatchedService);

  mode = signal<AppMode>('channels');
  channels = signal<Channel[]>([]);
  currentChannel = signal<Channel | null>(null);
  currentState = signal<ChannelState | null>(null);
  showStatic = signal<boolean>(true);
  isMuted = signal<boolean>(false);
  isFullscreen = signal<boolean>(false);
  apiUrl = environment.apiUrl;

  // Playback controls (series mode)
  isPaused = signal<boolean>(false);
  progressPercent = signal<number>(0);
  currentTimeFormatted = signal<string>('0:00');
  durationFormatted = signal<string>('0:00');
  audioTracks = signal<any[]>([]);
  currentAudioTrack = signal<number>(0);
  volumeLevel = signal<number>(1);

  private overlayFsTimeout?: ReturnType<typeof setTimeout>;
  private isEpisodeOverlay = signal<boolean>(false);
  private isHovering = signal<boolean>(false);
  showOverlay = computed(() => this.isEpisodeOverlay() || this.isHovering());

  showSeriesDialog = signal<boolean>(false);
  showSettingsDialog = signal<boolean>(false);
  showFiltersPanel = signal<boolean>(false);

  allSeries = signal<SeriesResponse[]>([]);
  episodeTypes = signal<EpisodeType[]>([]);
  seriesSearchName = signal<string>('');
  seriesFilterChannelId = signal<number | null>(null);
  seriesPage = signal<number>(1);
  seriesTotalPages = signal<number>(1);
  seriesTotalCount = signal<number>(0);
  seriesLoading = signal<boolean>(false);

  selectedSeries = signal<SeriesResponse | null>(null);
  seriesEpisodes = signal<EpisodeResponse[]>([]);
  selectedSeason = signal<number | null>(null);
  selectedEpisodeType = signal<string>('normal');
  currentEpisode = signal<EpisodeResponse | null>(null);

  showScheduleDialog = signal<boolean>(false);
  scheduleEntries = signal<ScheduleEntry[]>([]);
  scheduleLoading = signal<boolean>(false);

  watchedMap = signal<Record<number, boolean>>({});

  // iOS AV1 detection
  private readonly supportsAV1 = this.detectAV1Support();

  seasonGroups = computed(() => {
    const episodes = this.seriesEpisodes();
    return [
      ...new Set(
        episodes.filter((e) => e.episodeTypeName.toLowerCase() === 'regular').map((e) => e.season),
      ),
    ].sort((a, b) => a - b);
  });

  episodesForView = computed(() => {
    const episodes = this.seriesEpisodes();
    const type = this.selectedEpisodeType();
    const season = this.selectedSeason();
    const s = this.settings();
    if (type === 'normal')
      return episodes.filter(
        (e) => e.episodeTypeName.toLowerCase() === 'regular' && e.season === season,
      );
    if (type === 'special' && s.includeSpecials)
      return episodes.filter((e) => e.episodeTypeName.toLowerCase() === 'special');
    if (type === 'movie' && s.includeMovies)
      return episodes.filter((e) => e.episodeTypeName.toLowerCase() === 'movie');
    return [];
  });

  hasSpecials = computed(
    () =>
      this.settings().includeSpecials &&
      this.seriesEpisodes().some((e) => e.episodeTypeName.toLowerCase() === 'special'),
  );

  hasMovies = computed(
    () =>
      this.settings().includeMovies &&
      this.seriesEpisodes().some((e) => e.episodeTypeName.toLowerCase() === 'movie'),
  );

  activeFilters = computed(() =>
    this.isFullscreen() ? this.settings().filtersFullscreen : this.settings().filters,
  );

  settings = this.tvSettings.settings;

  private resizeObserver?: ResizeObserver;
  private hubConnection?: signalR.HubConnection;
  private overlayTimeout?: ReturnType<typeof setTimeout>;
  private progressInterval?: ReturnType<typeof setInterval>;
  private uiUpdateInterval?: ReturnType<typeof setInterval>;
  private readonly BUFFER_SECONDS = 20;
  private pendingNextEpisodePath: string | null = null;

  constructor() {
    effect(() => {
      const f = this.activeFilters();
      this.applyVideoFilters(f.scanlineIntensity, f.scanlineDensity, f.crtCurvature, f.vignette);
    });
  }

  ngAfterViewInit(): void {
    this.loadChannels();
    this.loadEpisodeTypes();
    this.setupResizeObserver();
    setTimeout(() => this.adjustOverlay(), 100);

    document.addEventListener('mousemove', this.fsMouseMoveHandler);
    document.addEventListener('fullscreenchange', this.fullscreenHandler);

    this.route.queryParams.subscribe((params) => {
      if (params['serie']) {
        this.http
          .get<PagedResult<SeriesResponse>>(`${this.apiUrl}/api/v1/public/series`, {
            params: { name: params['serie'].replace(/-/g, ' '), pageSize: 1 },
          })
          .subscribe({
            next: (result) => {
              if (result.items.length) this.enterSeriesMode(result.items[0]);
            },
          });
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.hubConnection?.stop();
    clearTimeout(this.overlayTimeout);
    clearInterval(this.progressInterval);
    clearInterval(this.uiUpdateInterval);
    document.removeEventListener('fullscreenchange', this.fullscreenHandler);
    document.removeEventListener('mousemove', this.fsMouseMoveHandler);
    clearTimeout(this.overlayFsTimeout);
  }

  // ── iOS / AV1 ──────────────────────────────────────────────────────────────

  private detectAV1Support(): boolean {
    const video = document.createElement('video');
    return (
      video.canPlayType('video/webm; codecs="av01.0.05M.08"') !== '' ||
      video.canPlayType('video/mp4; codecs="av01.0.05M.08"') !== ''
    );
  }

  private buildVideoSrc(filePath: string): string {
    const cleanPath = filePath.replace('wwwroot', '').replace(/\\/g, '/');
    const fullUrl = `${this.apiUrl}${cleanPath}`;

    // iOS no soporta AV1 en hardware, mostrar advertencia en consola y retornar igual
    // En un futuro se puede agregar un fallback path si se tienen archivos H.264
    if (!this.supportsAV1) {
      console.warn('[NostalgiaTV] AV1 not supported on this device. Video may not play correctly.');
    }

    return fullUrl;
  }

  // ── Audio Tracks ───────────────────────────────────────────────────────────

  private initAudioTracks(video: HTMLVideoElement): void {
    // La API AudioTrackList es experimental — verificar soporte
    const tracks = (video as any).audioTracks;
    if (!tracks || tracks.length === 0) {
      this.audioTracks.set([]);
      return;
    }

    const list: any[] = [];
    for (let i = 0; i < tracks.length; i++) {
      list.push(tracks[i]);
    }
    this.audioTracks.set(list);

    // Priorizar español
    this.setPreferredAudioTrack(video, list);
  }

  private setPreferredAudioTrack(video: HTMLVideoElement, tracks: any[]): void {
    const tracks_ = (video as any).audioTracks;
    if (!tracks_ || tracks_.length === 0) return;

    const spanishKeywords = ['spa', 'es', 'esp', 'spanish', 'español', 'castellano'];

    let spanishIndex = -1;
    for (let i = 0; i < tracks_.length; i++) {
      const t = tracks_[i] as any;
      const lang = (t.language || t.lang || '').toLowerCase();
      const label = (t.label || '').toLowerCase();
      if (spanishKeywords.some((kw) => lang.includes(kw) || label.includes(kw))) {
        spanishIndex = i;
        break;
      }
    }

    const targetIndex = spanishIndex >= 0 ? spanishIndex : 0;
    this.activateAudioTrack(video, targetIndex);
    this.currentAudioTrack.set(targetIndex);
  }

  private activateAudioTrack(video: HTMLVideoElement, index: number): void {
    const tracks = (video as any).audioTracks;
    if (!tracks) return;
    for (let i = 0; i < tracks.length; i++) {
      (tracks[i] as any).enabled = i === index;
    }
  }

  setAudioTrack(index: number): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    this.activateAudioTrack(video, index);
    this.currentAudioTrack.set(index);
  }

  getTrackLabel(track: any, index: number): string {
    const lang = (track?.language || track?.lang || '').toLowerCase();
    const label = track?.label || '';
    if (label) return label;
    if (lang) return lang.toUpperCase();
    return `Audio ${index + 1}`;
  }

  // ── Playback controls ──────────────────────────────────────────────────────

  togglePlayPause(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    if (video.paused) {
      video.play();
      this.isPaused.set(false);
    } else {
      video.pause();
      this.isPaused.set(true);
    }
  }

  seekTo(event: MouseEvent): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video || !video.duration) return;
    const bar = event.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const pct = (event.clientX - rect.left) / rect.width;
    video.currentTime = pct * video.duration;
  }

  private startUiUpdate(): void {
    clearInterval(this.uiUpdateInterval);
    this.uiUpdateInterval = setInterval(() => {
      const video = this.videoPlayer?.nativeElement;
      if (!video || !video.duration) return;
      const pct = (video.currentTime / video.duration) * 100;
      this.progressPercent.set(pct);
      this.currentTimeFormatted.set(this.formatTime(video.currentTime));
      this.durationFormatted.set(this.formatTime(video.duration));
      this.isPaused.set(video.paused);
    }, 500);
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Core video loading ─────────────────────────────────────────────────────

  private applyVideoFilters(
    intensity: number,
    density: number,
    curvature: boolean,
    vignette: boolean,
  ): void {
    const el = this.videoFilters?.nativeElement;
    if (!el) return;
    el.style.setProperty('--scanline-opacity', (intensity / 100).toString());
    el.style.setProperty('--scanline-size', `${density * 2}px`);
    el.style.setProperty('--curvature', curvature ? '1' : '0');
    el.style.setProperty('--vignette', vignette ? '1' : '0');
  }

  private loadChannels(): void {
    this.http.get<Channel[]>(`${this.apiUrl}/api/v1/public/channels`).subscribe({
      next: (data) => this.channels.set(data),
      error: () => {},
    });
  }

  private loadEpisodeTypes(): void {
    this.http.get<EpisodeType[]>(`${this.apiUrl}/api/v1/public/episode-types`).subscribe({
      next: (data) => this.episodeTypes.set(data),
      error: () => {},
    });
  }

  selectChannel(channel: Channel): void {
    this.stopProgressTracking();
    this.currentChannel.set(channel);
    this.showStatic.set(false);
    this.hubConnection?.stop();
    this.http
      .get<ChannelState>(`${this.apiUrl}/api/v1/public/channels/${channel.id}/state`)
      .subscribe({
        next: (state) => {
          this.currentState.set(state);
          setTimeout(() => {
            this.loadChannelEpisode(state);
            this.connectToHub(channel.id);
          }, 100);
        },
      });
  }

  private loadChannelEpisode(state: ChannelState): void {
    this.pendingNextEpisodePath = null;
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    video.src = `${this.apiUrl}${state.filePath}`;
    video.load();
    video.currentTime = state.currentSecond;
    video.muted = false;
    this.isMuted.set(false);
    video.play().catch(() => {
      video.muted = true;
      this.isMuted.set(true);
      video.play().catch((err) => console.error('Autoplay failed:', err));
    });
    this.isEpisodeOverlay.set(true);
    clearTimeout(this.overlayTimeout);
    this.overlayTimeout = setTimeout(() => this.isEpisodeOverlay.set(false), 5000);
  }

  private connectToHub(channelId: number): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/hubs/channel`)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ChannelState', (state: ChannelState) => {
      const current = this.currentState();
      const video = this.videoPlayer?.nativeElement;
      if (!video) return;

      if (current?.episodeId !== state.episodeId) {
        const remainingInCurrent = video.duration - video.currentTime;
        if (remainingInCurrent > 0 && remainingInCurrent <= this.BUFFER_SECONDS) {
          this.pendingNextEpisodePath = `${this.apiUrl}${state.filePath}`;
          video.addEventListener('ended', () => this.playPendingNext(state), { once: true });
        } else {
          this.currentState.set(state);
          this.loadChannelEpisode(state);
        }
      } else {
        this.currentState.set(state);
        this.syncVideoPosition(video, state.currentSecond);
      }
    });

    this.hubConnection.start().then(() => {
      this.hubConnection!.invoke('JoinChannel', channelId);
    });
  }

  private syncVideoPosition(video: HTMLVideoElement, serverSecond: number): void {
    if (!video.duration) return;
    const diff = Math.abs(video.currentTime - serverSecond);
    if (diff > this.BUFFER_SECONDS) video.currentTime = serverSecond;
  }

  private playPendingNext(state: ChannelState): void {
    this.pendingNextEpisodePath = null;
    this.currentState.set(state);
    this.loadChannelEpisode(state);
  }

  enterSeriesMode(serie: SeriesResponse): void {
    this.stopProgressTracking();
    this.hubConnection?.stop();
    this.selectedSeries.set(serie);
    this.mode.set('series');
    this.closeSeriesDialog();
    this.currentState.set(null);
    this.currentEpisode.set(null);
    this.selectedSeason.set(null);
    this.selectedEpisodeType.set('normal');

    const slug = serie.name.toLowerCase().replace(/\s+/g, '-');
    this.router.navigate([], { queryParams: { serie: slug }, replaceUrl: true });

    this.http
      .get<EpisodeResponse[]>(`${this.apiUrl}/api/v1/public/series/${serie.id}/episodes`)
      .subscribe({
        next: (episodes) => {
          this.seriesEpisodes.set(episodes);
          this.selectedSeason.set(this.seasonGroups()[0] ?? null);

          const progress = this.watchedService.getProgress(serie.id);
          const map: Record<number, boolean> = {};
          episodes.forEach((e) => {
            map[e.id] = progress[e.id]?.completed ?? false;
          });
          this.watchedMap.set(map);

          const inProgress = episodes.find(
            (e) => progress[e.id] && !progress[e.id].completed && progress[e.id].currentSecond > 0,
          );
          const target = inProgress ?? this.watchedService.getNextUnwatched(serie.id, episodes);

          if (target) {
            const ep = episodes.find((e) => e.id === (inProgress?.id ?? (target as any).id));
            if (ep) {
              if (ep.episodeTypeName.toLowerCase() === 'regular') {
                this.selectedSeason.set(ep.season);
                this.selectedEpisodeType.set('normal');
              } else if (ep.episodeTypeName.toLowerCase() === 'special') {
                this.selectEpisodeType('special');
              } else {
                this.selectEpisodeType('movie');
              }
              this.playEpisode(ep);
            }
          }
        },
      });
  }

  backToChannels(): void {
    this.stopProgressTracking();
    this.mode.set('channels');
    this.selectedSeries.set(null);
    this.seriesEpisodes.set([]);
    this.currentEpisode.set(null);
    this.watchedMap.set({});
    this.showStatic.set(true);
    this.hubConnection?.stop();
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
    const video = this.videoPlayer?.nativeElement;
    if (video) {
      video.src = '';
      video.load();
    }
    clearInterval(this.uiUpdateInterval);
  }

  selectSeason(season: number): void {
    this.selectedSeason.set(season);
    this.selectedEpisodeType.set('normal');
  }
  selectEpisodeType(type: string): void {
    this.selectedEpisodeType.set(type);
    this.selectedSeason.set(null);
  }

  playEpisode(episode: EpisodeResponse): void {
    if (!episode.filePath) return;

    const prev = this.currentEpisode();
    if (prev && this.selectedSeries()) this.markEpisodeCompleted(prev);

    this.stopProgressTracking();
    this.showStatic.set(false);

    setTimeout(() => {
      this.currentEpisode.set(episode);
      setTimeout(() => {
        const video = this.videoPlayer?.nativeElement;
        if (!video) return;

        const seriesId = this.selectedSeries()!.id;
        const savedSecond = this.watchedService.getLastProgress(seriesId, episode.id);

        video.src = this.buildVideoSrc(episode.filePath!);
        video.load();

        // Detectar pistas de audio después de que los metadatos estén listos
        video.addEventListener(
          'loadedmetadata',
          () => {
            this.initAudioTracks(video);
            video.currentTime = savedSecond > 0 ? savedSecond : 0;
          },
          { once: true },
        );

        video.muted = false;
        this.isMuted.set(false);
        video.play().catch(() => {
          video.muted = true;
          this.isMuted.set(true);
          video.play().catch((err) => console.error('Autoplay failed:', err));
        });

        this.isEpisodeOverlay.set(true);
        clearTimeout(this.overlayTimeout);
        this.overlayTimeout = setTimeout(() => this.isEpisodeOverlay.set(false), 5000);

        this.startProgressTracking(episode);
        this.startUiUpdate();
      }, 100);
    }, 0);
  }

  private startProgressTracking(episode: EpisodeResponse): void {
    const seriesId = this.selectedSeries()?.id;
    if (!seriesId) return;

    let markedAsWatched = false;

    this.progressInterval = setInterval(() => {
      const video = this.videoPlayer?.nativeElement;
      if (!video || !video.duration) return;

      const pct = video.currentTime / video.duration;
      this.watchedService.markProgress(seriesId, episode.id, video.currentTime, pct >= 0.95);

      if (pct >= 0.95 && !markedAsWatched) {
        markedAsWatched = true;
        this.markEpisodeCompleted(episode);
      }

      if (pct >= 0.99 || video.ended) {
        clearInterval(this.progressInterval);
        if (this.settings().randomPlayback) this.playRandomEpisode();
        else this.playNextEpisode(episode);
      }
    }, 5000);
  }

  private stopProgressTracking(): void {
    clearInterval(this.progressInterval);
  }

  private markEpisodeCompleted(episode: EpisodeResponse): void {
    const seriesId = this.selectedSeries()?.id;
    if (!seriesId) return;
    this.watchedService.markProgress(seriesId, episode.id, 0, true);
    this.watchedMap.update((map) => ({ ...map, [episode.id]: true }));
  }

  private playNextEpisode(current: EpisodeResponse): void {
    const list = this.episodesForView();
    const idx = list.findIndex((e) => e.id === current.id);
    const next = list[idx + 1];
    if (next) this.playEpisode(next);
  }

  playRandomEpisode(): void {
    const list = this.episodesForView();
    const unwatched = list.filter((e) => !this.watchedMap()[e.id]);
    const pool = unwatched.length > 0 ? unwatched : list;
    const random = pool[Math.floor(Math.random() * pool.length)];
    if (random) this.playEpisode(random);
  }

  onRandomToggleChange(checked: boolean): void {
    this.tvSettings.update({ randomPlayback: checked });
    if (checked) this.playRandomEpisode();
  }

  resetSeriesProgress(): void {
    const serie = this.selectedSeries();
    if (!serie) return;
    this.watchedService.resetSeries(serie.id);
    const map: Record<number, boolean> = {};
    this.seriesEpisodes().forEach((e) => {
      map[e.id] = false;
    });
    this.watchedMap.set(map);
  }

  resetAllProgress(): void {
    this.watchedService.resetAll();
    this.watchedMap.set({});
  }

  openSeriesDialog(): void {
    this.showSeriesDialog.set(true);
    this.loadSeries();
  }
  closeSeriesDialog(): void {
    this.showSeriesDialog.set(false);
    this.seriesSearchName.set('');
    this.seriesFilterChannelId.set(null);
    this.seriesPage.set(1);
    this.allSeries.set([]);
  }

  loadSeries(): void {
    this.seriesLoading.set(true);
    const params: any = { page: this.seriesPage(), pageSize: 10 };
    if (this.seriesSearchName()) params['name'] = this.seriesSearchName();
    if (this.seriesFilterChannelId()) params['channelId'] = this.seriesFilterChannelId();
    this.http
      .get<PagedResult<SeriesResponse>>(`${this.apiUrl}/api/v1/public/series`, { params })
      .subscribe({
        next: (result) => {
          this.allSeries.set(result.items);
          this.seriesTotalPages.set(result.totalPages);
          this.seriesTotalCount.set(result.totalCount);
          this.seriesLoading.set(false);
        },
        error: () => this.seriesLoading.set(false),
      });
  }

  onSeriesSearchChange(value: string): void {
    this.seriesSearchName.set(value);
    this.seriesPage.set(1);
    this.loadSeries();
  }
  onChannelFilterChange(value: string): void {
    this.seriesFilterChannelId.set(value ? +value : null);
    this.seriesPage.set(1);
    this.loadSeries();
  }
  seriesNextPage(): void {
    if (this.seriesPage() < this.seriesTotalPages()) {
      this.seriesPage.update((p) => p + 1);
      this.loadSeries();
    }
  }
  seriesPrevPage(): void {
    if (this.seriesPage() > 1) {
      this.seriesPage.update((p) => p - 1);
      this.loadSeries();
    }
  }

  openSettingsDialog(): void {
    this.showSettingsDialog.set(true);
  }
  closeSettingsDialog(): void {
    this.showSettingsDialog.set(false);
  }
  toggleFiltersPanel(): void {
    this.showFiltersPanel.update((v) => !v);
  }
  closeFiltersPanel(): void {
    this.showFiltersPanel.set(false);
  }

  updateSetting(key: string, value: boolean | number): void {
    this.tvSettings.update({ [key]: value } as any);
  }

  updateFilter(key: string, value: boolean | number): void {
    this.tvSettings.updateFilter({ [key]: value } as any, this.isFullscreen());
  }

  toggleFullscreen(): void {
    const overlay = this.screenOverlay?.nativeElement;
    if (!overlay) return;
    if (!document.fullscreenElement) overlay.requestFullscreen();
    else document.exitFullscreen();
  }

  onScreenHover(hovering: boolean): void {
    if (this.isFullscreen()) return;
    if (this.currentState() || this.currentEpisode()) this.isHovering.set(hovering);
  }

  toggleMute(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    video.muted = !video.muted;
    this.isMuted.set(video.muted);
  }

  volumeUp(): void {
    const v = this.videoPlayer?.nativeElement;
    if (v) {
      v.volume = Math.min(1, v.volume + 0.1);
      this.volumeLevel.set(v.volume);
    }
  }

  volumeDown(): void {
    const v = this.videoPlayer?.nativeElement;
    if (v) {
      v.volume = Math.max(0, v.volume - 0.1);
      this.volumeLevel.set(v.volume);
    }
  }

  setVolume(value: number): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    this.volumeLevel.set(value);
    this.isMuted.set(value === 0);
  }

  goToLogin(): void {
    this.router.navigate(['dashboard/login']);
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() =>
        requestAnimationFrame(() => this.adjustOverlay()),
      );
      this.resizeObserver.observe(this.tvContainer.nativeElement);
      window.addEventListener('resize', () => requestAnimationFrame(() => this.adjustOverlay()));
    }
  }

  private adjustOverlay(): void {
    const container = this.tvContainer.nativeElement;
    const overlay = this.screenOverlay.nativeElement;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    const originalWidth = 650,
      originalHeight = 759;
    const imageAspect = originalWidth / originalHeight;
    const containerAspect = containerWidth / containerHeight;
    let renderedWidth: number, renderedHeight: number;
    if (containerAspect > imageAspect) {
      renderedHeight = containerHeight;
      renderedWidth = renderedHeight * imageAspect;
    } else {
      renderedWidth = containerWidth;
      renderedHeight = renderedWidth / imageAspect;
    }
    const scale = renderedWidth / originalWidth;
    const leftOffset = (containerWidth - renderedWidth) / 2;
    const topOffset = (containerHeight - renderedHeight) / 2;
    overlay.style.width = `${255 * scale}px`;
    overlay.style.height = `${199 * scale}px`;
    overlay.style.left = `${leftOffset + 198 * scale}px`;
    overlay.style.top = `${topOffset + 27 * scale}px`;
  }

  private fullscreenHandler = () => {
    this.isFullscreen.set(!!document.fullscreenElement);
  };

  private fsMouseMoveHandler = () => {
    if (!this.isFullscreen()) return;
    this.isHovering.set(true);
    clearTimeout(this.overlayFsTimeout);
    this.overlayFsTimeout = setTimeout(() => this.isHovering.set(false), 3000);
  };

  openScheduleDialog(): void {
    const channel = this.currentChannel();
    if (!channel) return;
    this.showScheduleDialog.set(true);
    this.scheduleLoading.set(true);
    this.http
      .get<ScheduleEntry[]>(`${this.apiUrl}/api/v1/public/channels/${channel.id}/schedule`)
      .subscribe({
        next: (data) => {
          this.scheduleEntries.set(data);
          this.scheduleLoading.set(false);
        },
        error: () => this.scheduleLoading.set(false),
      });
  }

  closeScheduleDialog(): void {
    this.showScheduleDialog.set(false);
    this.scheduleEntries.set([]);
  }

  isCurrentScheduleEntry(entry: ScheduleEntry): boolean {
    const now = new Date();
    return new Date(entry.startTime) <= now && new Date(entry.endTime) > now;
  }
}
