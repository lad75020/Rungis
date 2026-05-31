import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-header',
  template: `
    <header class="app-header mb-4">
      <div class="app-header__brand">
        <div class="app-header__mark" aria-hidden="true">R</div>
        <div class="app-header__identity">
          <p class="app-header__eyebrow mb-1">Marché professionnel</p>
          <h1 class="app-header__title mb-0">{{ title() }}</h1>
        </div>
        @if (logoUrl(); as logo) {
          <img class="app-header__logo" [src]="logo" [alt]="logoAlt()" />
        }
      </div>

      <nav class="app-header__actions" aria-label="Workspace controls">
        <span
          class="app-header__status"
          [class.app-header__status--connected]="wsConnected()"
          [class.app-header__status--disconnected]="!wsConnected()"
          [attr.title]="wsConnected() ? wsConnectedTitle() : wsDisconnectedTitle()"
        >
          <span class="app-header__status-dot" aria-hidden="true"></span>
          <span>{{ wsConnected() ? 'Live' : 'Offline' }}</span>
        </span>

        <button
          type="button"
          class="app-header__button"
          [attr.aria-label]="languageLabel()"
          [attr.title]="languageLabel()"
          (click)="cycleLanguage.emit()"
        >
          <span class="app-header__button-label">Language</span>
          <span class="app-header__button-value">{{ languageCode() }}</span>
        </button>

        <button
          type="button"
          class="app-header__button"
          [attr.aria-label]="themeToggleLabel() + ': ' + themeDisplayLabel()"
          [attr.title]="themeToggleLabel() + ': ' + themeDisplayLabel()"
          (click)="cycleTheme.emit()"
        >
          <span class="app-header__button-label">Theme</span>
          <span class="app-header__button-value">{{ themeDisplayLabel() }}</span>
        </button>

        @if (hasSessionUser()) {
          <button
            type="button"
            class="app-header__button app-header__button--icon"
            [attr.aria-label]="accountLabel()"
            [attr.title]="accountLabel()"
            (click)="openAccount.emit()"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M12 12.5a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 1.75c-4.2 0-7.25 2.08-7.25 4.94 0 .45.36.81.81.81h12.88c.45 0 .81-.36.81-.81 0-2.86-3.05-4.94-7.25-4.94Z" />
            </svg>
            <span>Account</span>
          </button>

          <button
            type="button"
            class="app-header__button app-header__button--icon"
            [attr.aria-label]="logoutLabel()"
            [attr.title]="logoutLabel()"
            (click)="logout.emit()"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M14.75 4.75a1 1 0 0 0-1-1h-6A2.75 2.75 0 0 0 5 6.5v11A2.75 2.75 0 0 0 7.75 20h6a1 1 0 1 0 0-2h-6a.75.75 0 0 1-.75-.75V6.75c0-.41.34-.75.75-.75h6a1 1 0 0 0 1-1.25ZM18.79 8.3a1 1 0 0 0-1.41 1.42l1.29 1.28h-7.92a1 1 0 1 0 0 2h7.92l-1.29 1.28a1 1 0 1 0 1.41 1.42l3-3a1 1 0 0 0 0-1.42l-3-2.98Z" />
            </svg>
            <span>Logout</span>
          </button>
        }
      </nav>
    </header>
  `,
  styles: [`
    :host {
      display: block;
    }

    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.85rem 0.95rem;
      border: 1px solid var(--app-border, #d7e5de);
      border-radius: 1.35rem;
      background: var(--app-topbar-bg, rgba(255, 255, 255, 0.88));
      box-shadow: var(--app-shadow-1, 0 10px 30px rgba(15, 50, 42, 0.08));
      color: var(--app-text, #10201b);
      backdrop-filter: blur(14px);
    }

    .app-header__brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      min-width: 0;
    }

    .app-header__mark {
      width: 2.9rem;
      height: 2.9rem;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border-radius: 0.95rem;
      color: #fff;
      font-weight: 850;
      font-size: 1.22rem;
      letter-spacing: -0.04em;
      background: linear-gradient(135deg, var(--app-primary, #0f6b57), var(--app-accent, #c9772b));
      box-shadow: 0 12px 26px color-mix(in srgb, var(--app-primary, #0f6b57) 22%, transparent);
    }

    .app-header__identity {
      min-width: 0;
    }

    .app-header__eyebrow {
      color: var(--app-muted, #52635d);
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.13em;
      text-transform: uppercase;
    }

    .app-header__title {
      color: var(--app-text, #10201b);
      font-size: clamp(1.55rem, 2.2vw, 2.15rem);
      font-weight: 850;
      letter-spacing: -0.04em;
      line-height: 1.04;
    }

    .app-header__logo {
      width: 3rem;
      height: 3rem;
      flex: 0 0 auto;
      object-fit: contain;
      border-radius: 0.9rem;
      background: var(--app-surface-solid, #fff);
      border: 1px solid var(--app-border, #d7e5de);
      padding: 0.25rem;
    }

    .app-header__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 0.55rem;
    }

    .app-header__status,
    .app-header__button {
      min-height: 2.35rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      border: 1px solid var(--app-border, #d7e5de);
      border-radius: 999px;
      background: var(--app-surface-solid, #fff);
      color: var(--app-text, #10201b);
      font-size: 0.82rem;
      font-weight: 780;
      line-height: 1;
      white-space: nowrap;
    }

    .app-header__status {
      padding: 0.35rem 0.78rem;
    }

    .app-header__status--connected {
      color: var(--app-success, #12824c);
      background: color-mix(in srgb, var(--app-success, #12824c) 9%, var(--app-surface-solid, #fff));
    }

    .app-header__status--disconnected {
      color: var(--app-danger, #b42338);
      background: color-mix(in srgb, var(--app-danger, #b42338) 9%, var(--app-surface-solid, #fff));
    }

    .app-header__status-dot {
      width: 0.58rem;
      height: 0.58rem;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 0 0.22rem color-mix(in srgb, currentColor 16%, transparent);
    }

    .app-header__button {
      padding: 0.35rem 0.78rem;
      cursor: pointer;
      transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
    }

    .app-header__button:hover,
    .app-header__button:focus-visible {
      transform: translateY(-1px);
      border-color: var(--app-primary, #0f6b57);
      color: var(--app-primary-strong, #0a4f41);
      box-shadow: var(--app-shadow-1, 0 10px 30px rgba(15, 50, 42, 0.08));
      outline: none;
    }

    .app-header__button-label {
      color: var(--app-muted, #52635d);
      font-size: 0.7rem;
      font-weight: 850;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .app-header__button-value {
      font-weight: 900;
    }

    .app-header__button--icon svg {
      width: 1.05rem;
      height: 1.05rem;
      fill: currentColor;
    }

    @media (max-width: 768px) {
      .app-header {
        align-items: flex-start;
        flex-direction: column;
      }

      .app-header__actions {
        justify-content: flex-start;
        width: 100%;
      }
    }
  `],
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

  languageCode(): string {
    const label = this.languageLabel().trim();
    const upperLabel = label.toUpperCase();

    if (upperLabel.startsWith('FR') || upperLabel.includes('FRENCH') || upperLabel.includes('FRAN')) {
      return 'FR';
    }

    if (upperLabel.startsWith('EN') || upperLabel.includes('ENGLISH') || upperLabel.includes('ANGL')) {
      return 'EN';
    }

    return upperLabel.slice(0, 2) || '--';
  }

  themeDisplayLabel(): string {
    const label = this.themeLabel().trim();
    const lowerLabel = label.toLowerCase();

    if (lowerLabel.endsWith('.light') || lowerLabel.includes('light') || lowerLabel.includes('clair')) {
      return 'Light';
    }

    if (lowerLabel.endsWith('.dark') || lowerLabel.includes('dark') || lowerLabel.includes('sombre')) {
      return 'Dark';
    }

    if (lowerLabel.endsWith('.system') || lowerLabel.includes('system') || lowerLabel.includes('système')) {
      return 'System';
    }

    if (label.includes('.')) {
      return 'System';
    }

    return label || 'System';
  }
}
