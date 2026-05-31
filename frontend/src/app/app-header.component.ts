import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-header',
  template: `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div class="d-flex align-items-center gap-3">
        <h1 class="h3 mb-1">{{ title() }}</h1>
        @if (logoUrl(); as logo) {
          <img class="app-user-logo" [src]="logo" [alt]="logoAlt()" />
        }
      </div>
      <div class="d-flex align-items-center gap-2">
        <span
          class="ws-dot"
          [class.ws-dot-connected]="wsConnected()"
          [class.ws-dot-disconnected]="!wsConnected()"
          [attr.title]="wsConnected() ? wsConnectedTitle() : wsDisconnectedTitle()"
          aria-hidden="true"
        ></span>
        <button
          type="button"
          class="header-icon-btn header-icon-btn-active"
          [attr.aria-label]="languageLabel()"
          [attr.title]="languageLabel()"
          (click)="cycleLanguage.emit()"
        >
          {{ languageFlag() }}
        </button>
        <button
          type="button"
          class="header-icon-btn header-icon-btn-active"
          [attr.aria-label]="themeToggleLabel() + ': ' + themeLabel()"
          [attr.title]="themeLabel()"
          (click)="cycleTheme.emit()"
        >
          {{ themeIcon() }}
        </button>
        @if (hasSessionUser()) {
          <button
            type="button"
            class="header-icon-btn"
            [attr.aria-label]="accountLabel()"
            [attr.title]="accountLabel()"
            (click)="openAccount.emit()"
          >
            👤
          </button>
        }
        <button
          type="button"
          class="header-icon-btn"
          [attr.aria-label]="logoutLabel()"
          [attr.title]="logoutLabel()"
          (click)="logout.emit()"
        >
          🚪
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppHeaderComponent {
  readonly title = input.required<string>();
  readonly logoUrl = input<string | null | undefined>(null);
  readonly logoAlt = input.required<string>();
  readonly wsConnected = input.required<boolean>();
  readonly wsConnectedTitle = input.required<string>();
  readonly wsDisconnectedTitle = input.required<string>();
  readonly languageLabel = input.required<string>();
  readonly languageFlag = input.required<string>();
  readonly themeToggleLabel = input.required<string>();
  readonly themeLabel = input.required<string>();
  readonly themeIcon = input.required<string>();
  readonly hasSessionUser = input.required<boolean>();
  readonly accountLabel = input.required<string>();
  readonly logoutLabel = input.required<string>();

  readonly cycleLanguage = output<void>();
  readonly cycleTheme = output<void>();
  readonly openAccount = output<void>();
  readonly logout = output<void>();
}
