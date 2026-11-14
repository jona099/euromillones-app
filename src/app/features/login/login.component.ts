import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LogoComponent } from '../../shared/brand/logo.component';

import { LoaderComponent } from '../../shared/loader/loader.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, LogoComponent, LoaderComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Combinación decorativa del panel de marca. */
  protected readonly balls = [7, 14, 23, 38, 45];
  protected readonly stars = [3, 9];

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();
    const err = await this.auth.login(email, password);

    this.loading.set(false);
    if (err) {
      this.error.set(err);
      return;
    }
    await this.router.navigate(['/dashboard']);
  }
}
