import { Component, signal, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface Episode {
  id: number;
  title: string;
  year: number;
}

@Component({
  selector: 'app-retro-tv',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './retro-tv.component.html',
  styleUrl: './retro-tv.component.scss'
})
export class RetroTvComponent implements AfterViewInit, OnDestroy {
  @ViewChild('tvContainer') tvContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('screenOverlay') screenOverlay!: ElementRef<HTMLDivElement>;

  episodes = signal<Episode[]>([
    { id: 1, title: 'Dragon Ball Z', year: 1989 },
    { id: 2, title: 'Los Caballeros del Zodiaco', year: 1986 },
    { id: 3, title: 'Thundercats', year: 1985 },
    { id: 4, title: 'He-Man', year: 1983 },
    { id: 5, title: 'Transformers', year: 1984 },
    { id: 6, title: 'Los Simpsons', year: 1989 },
    { id: 7, title: 'Ranma ½', year: 1989 },
    { id: 8, title: 'Sailor Moon', year: 1992 }
  ]);

  currentEpisode = signal<Episode | null>(null);
  showStatic = signal<boolean>(true);
  animationState = signal<number>(0);
  private resizeObserver?: ResizeObserver;

  constructor(private router: Router) {}

  ngAfterViewInit(): void {
    this.setupResizeObserver();
    setTimeout(() => this.adjustOverlay(), 100);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.adjustOverlay());
      this.resizeObserver.observe(this.tvContainer.nativeElement);
    } else {
      window.addEventListener('resize', () => this.adjustOverlay());
    }
  }

  private adjustOverlay(): void {
    const container = this.tvContainer.nativeElement;
    const overlay = this.screenOverlay.nativeElement;
    const containerRect = container.getBoundingClientRect();

    const originalWidth = 650;
    const originalHeight = 759;
    const containerAspect = containerRect.width / containerRect.height;
    const imageAspect = originalWidth / originalHeight;

    let renderedWidth: number, renderedHeight: number;

    if (containerAspect > imageAspect) {
      renderedHeight = containerRect.height;
      renderedWidth = renderedHeight * imageAspect;
    } else {
      renderedWidth = containerRect.width;
      renderedHeight = renderedWidth / imageAspect;
    }

    const screenLeft = 225;
    const screenTop = 28;
    const screenWidth = 270;
    const screenHeight = 210;
    const scale = renderedWidth / originalWidth;

    const overlayWidth = screenWidth * scale;
    const overlayHeight = screenHeight * scale;
    const overlayLeft = screenLeft * scale;
    const overlayTop = screenTop * scale;
    const leftOffset = (containerRect.width - renderedWidth) / 2;
    const topOffset = (containerRect.height - renderedHeight) / 2;

    overlay.style.width = `${overlayWidth}px`;
    overlay.style.height = `${overlayHeight}px`;
    overlay.style.left = `${leftOffset + overlayLeft}px`;
    overlay.style.top = `${topOffset + overlayTop}px`;
  }

  selectChannel(episode: Episode): void {
    this.currentEpisode.set(episode);
    this.showStatic.set(false);
    this.animationState.update(v => v + 1);
  }

  goToLogin(): void {
    this.router.navigate(['dashboard/login']);
  }
}
