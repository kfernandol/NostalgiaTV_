import { Component, input, output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TvSettings } from '../../../../core/services/tv-settings.service';
import { SeriesResponse } from '../../../models/serie.model';

interface Channel { id: number; name: string; logoPath?: string; }
interface ScheduleEntry {
  id: number; channelId: number; episodeId: number;
  episodeTitle: string; seriesName: string; seriesLogoPath?: string;
  filePath: string; startTime: string; endTime: string;
  season: number; episodeNumber: number;
}

@Component({
  selector: 'app-retro-tv-dialogs',
  standalone: true,
  imports: [CommonModule, DatePipe, MatButtonModule, MatIconModule],
  templateUrl: './retro-tv-dialogs.component.html',
  styleUrl: './retro-tv-dialogs.component.scss',
})
export class RetroTvDialogsComponent {
  // Series dialog
  showSeriesDialog = input<boolean>(false);
  allSeries = input<SeriesResponse[]>([]);
  seriesLoading = input<boolean>(false);
  seriesPage = input<number>(1);
  seriesTotalPages = input<number>(1);
  seriesSearchName = input<string>('');
  channels = input<Channel[]>([]);
  apiUrl = input<string>('');

  // Settings dialog
  showSettingsDialog = input<boolean>(false);
  settings = input.required<TvSettings>();

  // Schedule dialog
  showScheduleDialog = input<boolean>(false);
  scheduleEntries = input<ScheduleEntry[]>([]);
  scheduleLoading = input<boolean>(false);

  // Series dialog outputs
  closeSeriesDialog = output<void>();
  enterSeries = output<SeriesResponse>();
  searchChange = output<string>();
  channelFilterChange = output<string>();
  nextPage = output<void>();
  prevPage = output<void>();

  // Settings outputs
  closeSettingsDialog = output<void>();
  updateSetting = output<{ key: string; value: boolean | number }>();
  resetAll = output<void>();

  // Schedule outputs
  closeScheduleDialog = output<void>();

  isCurrentEntry(entry: ScheduleEntry): boolean {
    const now = new Date();
    return new Date(entry.startTime) <= now && new Date(entry.endTime) > now;
  }

  toLocalTime(utcString: string): Date {
      return new Date(utcString);
  }
}
