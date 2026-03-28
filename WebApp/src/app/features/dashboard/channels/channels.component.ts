import { Component, OnInit, signal, ViewChild, AfterViewInit } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { Validators } from '@angular/forms';
import { ChannelsService } from './channels.service';
import { SeriesService } from '../series/series.service';
import { ChannelResponse } from '../../../shared/models/channel.model';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import {
  DialogConfig,
  GenericFormDialogComponent,
} from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { DatePipe } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-channels',
  imports: [
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatCardModule,
    DatePipe,
  ],
  templateUrl: './channels.component.html',
  styleUrl: './channels.component.scss',
})
export class ChannelsComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  series = signal<SeriesResponse[]>([]);
  displayedColumns = ['id', 'name', 'logo', 'history', 'startDate', 'endDate', 'series', 'actions'];
  dataSource = new MatTableDataSource<ChannelResponse>([]);
  apiUrl = environment.apiUrl;

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

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  loadChannels() {
    this.channelsService.getAll().subscribe({
      next: (data) => (this.dataSource.data = data),
      error: () => this.showError('Error loading channels'),
    });
  }

  openForm(channel?: ChannelResponse) {
    const config: DialogConfig = {
      title: 'Channel',
      fields: [
        { key: 'name', label: 'Name', type: 'text', validators: [Validators.required] },
        { key: 'logo', label: 'Logo', type: 'file' },
        { key: 'history', label: 'History', type: 'textarea' },
        {
          key: 'startDate',
          label: 'Start Date',
          type: 'datepicker',
          validators: [Validators.required],
        },
        { key: 'endDate', label: 'End Date', type: 'datepicker' },
      ],
      data: channel ? { ...channel, logo: environment.apiUrl + channel.logoPath } : null,
    };

    const dialogRef = this.dialog.open(GenericFormDialogComponent, {
      width: '500px',
      data: config,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;

      // Siempre construir FormData para channels porque el backend espera multipart
      let payload: FormData;
      if (result.isMultipart) {
        payload = result.formData;
      } else {
        payload = new FormData();
        const data = result.data;
        Object.keys(data).forEach((key) => {
          if (data[key] !== null && data[key] !== undefined && data[key] !== '')
            payload.append(key, data[key]);
        });
      }

      if (channel) {
        this.channelsService.update(channel.id, payload).subscribe({
          next: (updated) => {
            this.dataSource.data = this.dataSource.data.map((c) =>
              c.id === updated.id ? updated : c,
            );
            this.showSuccess('Channel updated');
          },
          error: () => this.showError('Error updating channel'),
        });
      } else {
        this.channelsService.create(payload).subscribe({
          next: (created) => {
            this.dataSource.data = [...this.dataSource.data, created];
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
      this.channelsService.assignSeries(channel.id, result.data).subscribe({
        next: (updated) => {
          this.dataSource.data = this.dataSource.data.map((c) =>
            c.id === updated.id ? updated : c,
          );
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
