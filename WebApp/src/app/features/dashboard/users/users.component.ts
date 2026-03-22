import { Component, OnInit, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { Validators } from '@angular/forms';
import { UsersService } from './users.service';
import { RolesService } from '../roles/roles.service';
import { UserResponse } from '../../../shared/models/user.model';
import { RolResponse } from '../../../shared/models/rol.model';
import { DialogConfig, GenericFormDialogComponent } from '../../../shared/components/dialogs/generic-form-dialog/generic-form-dialog.component';
import { CustomizerSettingsService } from '../../../shared/components/customizer-settings/customizer-settings.service';

@Component({
    selector: 'app-users',
    imports: [MatTableModule, MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule, MatCardModule],
    templateUrl: './users.component.html',
    styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {

    users = signal<UserResponse[]>([]);
    roles = signal<RolResponse[]>([]);
    displayedColumns = ['id', 'username', 'rol', 'actions'];

    constructor(
        private usersService: UsersService,
        private rolesService: RolesService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        public themeService: CustomizerSettingsService
    ) {}

    ngOnInit() {
        this.usersService.getAll().subscribe({
            next: data => this.users.set(data),
            error: () => this.showError('Error loading users')
        });
        this.rolesService.getAll().subscribe({
            next: data => this.roles.set(data),
            error: () => this.showError('Error loading roles')
        });
    }

    openForm(user?: UserResponse) {
        const config: DialogConfig = {
            title: 'User',
            fields: [
                { key: 'username', label: 'Username', type: 'text', validators: [Validators.required, Validators.maxLength(50)] },
                { key: 'password', label: 'Password', type: 'text', validators: user ? [Validators.minLength(8), Validators.maxLength(50)] : [Validators.required, Validators.minLength(8), Validators.maxLength(50)] },
                {
                    key: 'rolId',
                    label: 'Role',
                    type: 'select',
                    validators: [Validators.required],
                    options: this.roles().map(r => ({ value: r.id, label: r.name }))
                }
            ],
            data: user ? { username: user.username, rolId: user.rol.id } : null
        };

        const dialogRef = this.dialog.open(GenericFormDialogComponent, {
            width: '500px',
            data: config,
            panelClass: this.themeService.isDark() ? 'dark-theme' : ''
        });

        dialogRef.afterClosed().subscribe(result => {
            if (!result) return;
            const payload = result.data;
            if (user) {
                this.usersService.update(user.id, payload).subscribe({
                    next: updated => {
                        this.users.update(list => list.map(u => u.id === updated.id ? updated : u));
                        this.showSuccess('User updated');
                    },
                    error: () => this.showError('Error updating user')
                });
            } else {
                this.usersService.create(payload).subscribe({
                    next: created => {
                        this.users.update(list => [...list, created]);
                        this.showSuccess('User created');
                    },
                    error: () => this.showError('Error creating user')
                });
            }
        });
    }

    delete(id: number) {
        this.usersService.delete(id).subscribe({
            next: () => {
                this.users.update(list => list.filter(u => u.id !== id));
                this.showSuccess('User deleted');
            },
            error: () => this.showError('Error deleting user')
        });
    }

    private showSuccess(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000 });
    }

    private showError(msg: string) {
        this.snackBar.open(msg, 'Close', { duration: 3000, panelClass: 'error-snack' });
    }
}
