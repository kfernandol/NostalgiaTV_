import { Component, signal, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../../environments/environment';
import * as signalR from '@microsoft/signalr';

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
}

@Component({
  selector: 'app-retro-tv',
  imports: [CommonModule, MatButtonModule, MatIconModule],
  standalone: true,
  templateUrl: './retro-tv.component.html',
  styleUrl: './retro-tv.component.scss',
})
export class RetroTvComponent implements AfterViewInit, OnDestroy {
  @ViewChild('tvContainer') tvContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('screenOverlay') screenOverlay!: ElementRef<HTMLDivElement>;
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  channels = signal<Channel[]>([]);
  currentChannel = signal<Channel | null>(null);
  currentState = signal<ChannelState | null>(null);
  showStatic = signal<boolean>(true);
  showOverlay = signal<boolean>(false);
  isMuted = signal<boolean>(false);
  animationState = signal<number>(0);
  apiUrl = environment.apiUrl;

  private resizeObserver?: ResizeObserver;
  private hubConnection?: signalR.HubConnection;
  private overlayTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private router: Router,
    private http: HttpClient,
  ) {}

  ngAfterViewInit(): void {
    this.loadChannels();
    this.setupResizeObserver();
    setTimeout(() => this.adjustOverlay(), 100);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.hubConnection?.stop();
    clearTimeout(this.overlayTimeout);
  }

  private loadChannels(): void {
    this.http.get<Channel[]>(`${this.apiUrl}/api/v1/public/channels`).subscribe({
      next: (data) => this.channels.set(data),
      error: () => {},
    });
  }

  selectChannel(channel: Channel): void {
    this.currentChannel.set(channel);
    this.showStatic.set(false);
    this.animationState.update(v => v + 1);

    this.hubConnection?.stop();

    this.http.get<ChannelState>(`${this.apiUrl}/api/v1/public/channels/${channel.id}/state`).subscribe({
        next: state => {
            this.currentState.set(state);
            setTimeout(() => {
                this.loadEpisode(state);
                this.connectToHub(channel.id);
            }, 100); // wait for @if to render the video element
        }
    });
}

  private loadEpisode(state: ChannelState): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;

    video.muted = true;
    this.isMuted.set(true);
    video.src = `${this.apiUrl}${state.filePath}`;
    video.load();
    video.currentTime = state.currentSecond;
    video.play().catch(err => console.error('Autoplay failed:', err));

    this.showOverlay.set(true);
    clearTimeout(this.overlayTimeout);
    this.overlayTimeout = setTimeout(() => this.showOverlay.set(false), 5000);
}

  private connectToHub(channelId: number): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/hubs/channel`)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('ChannelState', (state: ChannelState) => {
      const current = this.currentState();
      if (current?.episodeId !== state.episodeId) {
        this.loadEpisode(state);
      }
    });

    this.hubConnection.start().then(() => {
      this.hubConnection!.invoke('JoinChannel', channelId);
    });
  }

  toggleMute(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    video.muted = !video.muted;
    this.isMuted.set(video.muted);
  }

  volumeUp(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    video.volume = Math.min(1, video.volume + 0.1);
  }

  volumeDown(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    video.volume = Math.max(0, video.volume - 0.1);
  }

  toggleFullscreen(): void {
    const video = this.videoPlayer?.nativeElement;
    if (!video) return;
    if (!document.fullscreenElement) {
      video.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  goToLogin(): void {
    this.router.navigate(['dashboard/login']);
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => this.adjustOverlay());
      });
      this.resizeObserver.observe(this.tvContainer.nativeElement);
      window.addEventListener('resize', () => {
        requestAnimationFrame(() => this.adjustOverlay());
      });
    }
  }

  private adjustOverlay(): void {
    const container = this.tvContainer.nativeElement;
    const overlay = this.screenOverlay.nativeElement;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    const originalWidth = 650;
    const originalHeight = 759;
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
}
