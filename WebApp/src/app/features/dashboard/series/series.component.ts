import { Component, OnInit, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SeriesService } from './series.service';
import { SeriesResponse } from '../../../shared/models/serie.model';
import { DialogConfig, GenericFormDialogComponent } from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { Validators } from '@angular/forms';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';
import { MatCardModule } from '@angular/material/card';

@Component({
    selector: 'app-series',
    imports: [MatTableModule, MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule, MatCardModule],
    templateUrl: './series.component.html',
    styleUrl: './series.component.scss'
})
export class SeriesComponent implements OnInit {

    series = signal<SeriesResponse[]>([]);
    displayedColumns = ['id', 'name', 'description', 'actions'];

    constructor(
        private seriesService: SeriesService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        public themeService: CustomizerSettingsService
    ) {}

    ngOnInit() {
        this.loadSeries();
    }

    loadSeries() {
        this.seriesService.getAll().subscribe({
            next: data => this.series.set(data),
            error: () => this.showError('Error loading series')
        });
    }

    delete(id: number) {
        this.seriesService.delete(id).subscribe({
            next: () => {
                this.series.update(list => list.filter(s => s.id !== id));
                this.showSuccess('Series deleted');
            },
            error: () => this.showError('Error deleting series')
        });
    }

    openForm(series?: SeriesResponse) {
      const config: DialogConfig = {
        title: 'Series',
        fields: [
            { key: 'name', label: 'Name', type: 'text', validators: [Validators.required, Validators.maxLength(100)] },
            { key: 'description', label: 'Description', type: 'textarea' }
        ],
        data: series ?? null
      };

      const dialogRef = this.dialog.open(GenericFormDialogComponent, {
        width: '500px',
        data: config,
        panelClass: this.themeService.isDark() ? 'dark-theme' : ''
      });

      dialogRef.afterClosed().subscribe(result => {
          if (!result) return;
          if (series) {
              this.seriesService.update(series.id, result).subscribe({
                  next: updated => {
                      this.series.update(list => list.map(s => s.id === updated.id ? updated : s));
                      this.showSuccess('Series updated');
                  },
                  error: () => this.showError('Error updating series')
              });
          } else {
              this.seriesService.create(result).subscribe({
                  next: created => {
                      this.series.update(list => [...list, created]);
                      this.showSuccess('Series created');
                  },
                  error: () => this.showError('Error creating series')
              });
          }
      });
    }

    private showSuccess(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000 });
    }

    private showError(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' });
    }
}
