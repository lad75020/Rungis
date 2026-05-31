import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AppToast } from './app.types';

@Component({
  selector: 'app-toast-stack',
  template: `
    @if (toasts().length > 0) {
      <div class="toast-stack" aria-live="polite" aria-atomic="true">
        @for (toast of toasts(); track toast.id) {
          <div
            class="toast show border-0 mb-2"
            [class.text-bg-info]="toast.type === 'info'"
            [class.text-bg-success]="toast.type === 'success'"
            [class.text-bg-warning]="toast.type === 'warning'"
            [class.text-bg-danger]="toast.type === 'danger'"
            [attr.role]="toast.type === 'danger' || toast.type === 'warning' ? 'alert' : 'status'"
          >
            <div class="d-flex align-items-start">
              <div class="toast-body">{{ toast.message }}</div>
              <button
                type="button"
                class="btn-close me-2 mt-2"
                [class.btn-close-white]="toast.type !== 'warning'"
                [attr.aria-label]="closeLabel()"
                (click)="dismiss.emit(toast.id)"
              ></button>
            </div>
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastStackComponent {
  readonly toasts = input.required<AppToast[]>();
  readonly closeLabel = input('Close');

  readonly dismiss = output<number>();
}
