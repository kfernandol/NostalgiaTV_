import { Component, OnInit, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { EpisodesService } from './episodes.service';
import { SeriesService } from '../series/series.service';
import { EpisodeResponse } from '../../../shared/models/episode.model';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import { DialogConfig, GenericFormDialogComponent } from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';

@Component({
    selector: 'app-episodes',
    imports: [MatTableModule, MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule, MatCardModule, MatSelectModule, MatFormFieldModule, FormsModule],
    templateUrl: './episodes.component.html',
    styleUrl: './episodes.component.scss'
})
export class EpisodesComponent implements OnInit {

    episodes = signal<EpisodeResponse[]>([]);
    series = signal<SeriesResponse[]>([]);
    episodeTypes = signal<{ id: number; name: string }[]>([
        { id: 1, name: 'Regular' },
        { id: 2, name: 'Special' },
        { id: 3, name: 'Christmas Special' },
        { id: 4, name: 'Halloween Special' },
        { id: 5, name: 'Movie' }
    ]);
    selectedSeriesId = signal<number | null>(null);
    displayedColumns = ['id', 'season', 'title', 'type', 'filePath', 'actions'];

    constructor(
        private episodesService: EpisodesService,
        private seriesService: SeriesService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        public themeService: CustomizerSettingsService
    ) {}

    ngOnInit() {
        this.seriesService.getAll().subscribe({
            next: data => this.series.set(data),
            error: () => this.showError('Error loading series')
        });
    }

    onSeriesChange(seriesId: number) {
        this.selectedSeriesId.set(seriesId);
        this.loadEpisodes(seriesId);
    }

    loadEpisodes(seriesId: number) {
        this.episodesService.getBySeries(seriesId).subscribe({
            next: data => this.episodes.set(data),
            error: () => this.showError('Error loading episodes')
        });
    }

    scan() {
        if (!this.selectedSeriesId()) {
            this.showError('Select a series first');
            return;
        }
        this.episodesService.scan(this.selectedSeriesId()!).subscribe({
            next: data => {
                this.episodes.set(data);
                this.showSuccess('Episodes synced from folder');
            },
            error: () => this.showError('Error scanning folder')
        });
    }

    changeType(episode: EpisodeResponse) {
        // Only allow changing type for non-regular episodes
        const allowedTypes = this.episodeTypes().filter(t =>
            t.id !== 1 && t.id !== 5 // exclude Regular and Movie
        );

        const config: DialogConfig = {
            title: 'Change Episode Type',
            fields: [
                {
                    key: 'episodeTypeId',
                    label: 'Type',
                    type: 'select',
                    options: allowedTypes.map(t => ({ value: t.id, label: t.name }))
                }
            ],
            data: { episodeTypeId: episode.episodeTypeId }
        };

        const dialogRef = this.dialog.open(GenericFormDialogComponent, {
            width: '400px',
            data: config,
            panelClass: this.themeService.isDark() ? 'dark-theme' : ''
        });

        dialogRef.afterClosed().subscribe(result => {
          if (!result) return;
          this.episodesService.update(episode.id, { episodeTypeId: result.data.episodeTypeId }).subscribe({
              next: updated => {
                  this.episodes.update(list => list.map(e => e.id === updated.id ? updated : e));
                  this.showSuccess('Episode type updated');
              },
              error: () => this.showError('Error updating episode type')
          });
        });
    }

    isSpecial(episode: EpisodeResponse) {
        return episode.episodeTypeId === 2 || episode.episodeTypeId === 3 || episode.episodeTypeId === 4;
    }

    private showSuccess(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000 });
    }

    private showError(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' });
    }
}
