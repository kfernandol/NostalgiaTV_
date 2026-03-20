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
import { Validators } from '@angular/forms';
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
    selectedSeriesId = signal<number | null>(null);
    displayedColumns = ['id', 'order', 'title', 'filePath', 'actions'];

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
        this.episodesService.getBySeries(seriesId).subscribe({
            next: data => this.episodes.set(data),
            error: () => this.showError('Error loading episodes')
        });
    }

    openForm() {
        if (!this.selectedSeriesId()) {
            this.showError('Select a series first');
            return;
        }

        const config: DialogConfig = {
            title: 'Episode',
            fields: [
                { key: 'title', label: 'Title', type: 'text', validators: [Validators.required, Validators.maxLength(100)] },
                { key: 'filePath', label: 'File Path', type: 'text', validators: [Validators.required] },
                { key: 'order', label: 'Order', type: 'number', validators: [Validators.required, Validators.min(1)] }
            ],
            data: null
        };

        const dialogRef = this.dialog.open(GenericFormDialogComponent, {
            width: '500px',
            data: config
        });

        dialogRef.afterClosed().subscribe(result => {
            if (!result) return;
            const request = { ...result, seriesId: this.selectedSeriesId() };
            this.episodesService.create(request).subscribe({
                next: created => {
                    this.episodes.update(list => [...list, created]);
                    this.showSuccess('Episode created');
                },
                error: () => this.showError('Error creating episode')
            });
        });
    }

    private showSuccess(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000 });
    }

    private showError(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' });
    }
}
