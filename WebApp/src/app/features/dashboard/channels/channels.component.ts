import { Component, OnInit, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { Validators } from '@angular/forms';
import { ChannelsService } from './channels.service';
import { SeriesService } from '../series/series.service';
import { ChannelResponse } from '../../../shared/models/channel.model';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import {
  DialogConfig,
  GenericFormDialogComponent,
} from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { SeriesResponse } from '../../../shared/models/serie.model';

@Component({
  selector: 'app-channels',
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatCardModule,
  ],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
})
export class ChannelsComponent implements OnInit {
  channels = signal<ChannelResponse[]>([]);
  series = signal<SeriesResponse[]>([]);
  displayedColumns = ['id', 'name', 'isRandom', 'series', 'actions'];

  constructor(
    private channelsService: ChannelsService,
    private seriesService: SeriesService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    public themeService: CustomizerSettingsService,
  ) {}

  ngOnInit() {
    this.loadChannels();
    this.seriesService.getAll().subscribe({
      next: (data) => this.series.set(data),
      error: () => this.showError('Error loading series'),
    });
  }

  loadChannels() {
    this.channelsService.getAll().subscribe({
      next: (data) => this.channels.set(data),
      error: () => this.showError('Error loading channels'),
    });
  }

  openForm(channel?: ChannelResponse) {
    const config: DialogConfig = {
      title: 'Channel',
      fields: [
        {
          key: 'name',
          label: 'Name',
          type: 'text',
          validators: [Validators.required, Validators.maxLength(100)],
        },
        {
          key: 'isRandom',
          label: 'Random Playback',
          type: 'select',
          options: [
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ],
        },
      ],
      data: channel ?? null,
    };

    const dialogRef = this.dialog.open(GenericFormDialogComponent, {
      width: '500px',
      data: config,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      if (channel) {
        // update no implementado aun
      } else {
        this.channelsService.create(result).subscribe({
          next: (created) => {
            this.channels.update((list) => [...list, created]);
            this.showSuccess('Channel created');
          },
          error: () => this.showError('Error creating channel'),
        });
      }
    });
  }

  assignSeries(channel: ChannelResponse) {
    const config: DialogConfig = {
      title: 'Assign Series',
      fields: [
        {
          key: 'seriesIds',
          label: 'Series',
          type: 'multiselect',
          options: this.series().map((s) => ({ value: s.id, label: s.name })),
        },
      ],
      data: { seriesIds: channel.seriesIds },
    };

    const dialogRef = this.dialog.open(GenericFormDialogComponent, {
      width: '500px',
      data: config,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      this.channelsService.assignSeries(channel.id, result).subscribe({
        next: (updated) => {
          this.channels.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
          this.showSuccess('Series assigned');
        },
        error: () => this.showError('Error assigning series'),
      });
    });
  }

  getSeriesNames(seriesIds: number[]) {
    return seriesIds.map((id) => this.series().find((s) => s.id === id)?.name ?? id).join(', ');
  }

  private showSuccess(msg: string) {
    this.snackBar.open(msg, 'Close', { duration: 3000 });
  }

  private showError(msg: string) {
    this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' });
  }
}
