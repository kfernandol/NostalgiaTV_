import { Component, OnInit, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { Validators } from '@angular/forms';
import { RolesService } from './roles.service';
import { MenuService } from '../../../core/services/menu.service';
import { RolResponse } from '../../../shared/models/rol.model';
import { MenuResponse } from '../../../shared/models/menu.model';
import {
  DialogConfig,
  GenericFormDialogComponent,
} from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';

@Component({
  selector: 'app-roles',
  imports: [
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatCardModule,
  ],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss',
})
export class RolesComponent implements OnInit {
  roles = signal<RolResponse[]>([]);
  menus = signal<MenuResponse[]>([]);
  displayedColumns = ['id', 'name', 'description', 'actions'];

  constructor(
    private rolesService: RolesService,
    private menuService: MenuService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    public themeService: CustomizerSettingsService,
  ) {}

  allMenus = signal<MenuResponse[]>([]);

  ngOnInit() {
    this.rolesService.getAll().subscribe({
      next: (data) => this.roles.set(data),
      error: () => this.showError('Error loading roles'),
    });
    this.menuService.getAllMenus().subscribe({
      next: (data) => this.allMenus.set(data.filter((m) => m.parentId !== null)),
      error: () => this.showError('Error loading menus'),
    });
  }

  openForm(rol?: RolResponse) {
    const config: DialogConfig = {
      title: 'Role',
      fields: [
        {
          key: 'name',
          label: 'Name',
          type: 'text',
          validators: [Validators.required, Validators.maxLength(100)],
        },
        { key: 'description', label: 'Description', type: 'textarea' },
        {
          key: 'menuIds',
          label: 'Menus',
          type: 'multiselect',
          options: this.allMenus().map(m => ({ value: m.id, label: m.name }))
        },
      ],
      data: rol ?? null,
    };

    const dialogRef = this.dialog.open(GenericFormDialogComponent, {
      width: '500px',
      data: config,
      panelClass: this.themeService.isDark() ? 'dark-theme' : '',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      const payload = result.data;
      if (rol) {
        this.rolesService.update(rol.id, payload).subscribe({
          next: (updated) => {
            this.roles.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
            this.showSuccess('Role updated');
          },
          error: () => this.showError('Error updating role'),
        });
      } else {
        this.rolesService.create(payload).subscribe({
          next: (created) => {
            this.roles.update((list) => [...list, created]);
            this.showSuccess('Role created');
          },
          error: () => this.showError('Error creating role'),
        });
      }
    });
  }

  delete(id: number) {
    this.rolesService.delete(id).subscribe({
      next: () => {
        this.roles.update((list) => list.filter((r) => r.id !== id));
        this.showSuccess('Role deleted');
      },
      error: () => this.showError('Error deleting role'),
    });
  }

  getFlatMenus() {
    return this.menuService.menus().flatMap((m) => (m.children?.length ? m.children : [m]));
  }

  private showSuccess(msg: string) {
    this.snackBar.open(msg, 'Close', { duration: 3000 });
  }

  private showError(msg: string) {
    this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' });
  }
}
