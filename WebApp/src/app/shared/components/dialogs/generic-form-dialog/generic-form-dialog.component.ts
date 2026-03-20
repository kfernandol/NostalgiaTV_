import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CustomizerSettingsService } from '../../customizer-settings/customizer-settings.service';
import { MatCardActions, MatCardModule } from "@angular/material/card";

export interface DialogField {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect';
    validators?: ValidatorFn[];
    options?: { value: any; label: string }[];
}

export interface DialogConfig<T = any> {
    title: string;
    fields: DialogField[];
    data?: T;
}

@Component({
    selector: 'app-generic-form-dialog',
    imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule,
    MatCardActions,
    MatCardModule
],
    templateUrl: './generic-form-dialog.component.html'
})
export class GenericFormDialogComponent {

    form: FormGroup;
    isEdit: boolean;

    constructor(
        private fb: FormBuilder,
        private dialogRef: MatDialogRef<GenericFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public config: DialogConfig,
        public themeService: CustomizerSettingsService
    ) {
        this.isEdit = !!config.data;
        const controls: Record<string, any> = {};
        config.fields.forEach(field => {
            controls[field.key] = [config.data?.[field.key] ?? '', field.validators ?? []];
        });
        this.form = this.fb.group(controls);
    }

    submit() {
        if (this.form.invalid) return;
        this.dialogRef.close(this.form.value);
    }

    cancel() {
        this.dialogRef.close();
    }
}
