import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-legacy-page-placeholder',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegacyPagePlaceholderComponent {}
