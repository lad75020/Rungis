import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { App } from '../app';

@Component({
  selector: 'app-vendor-bills-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './vendor-bills-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VendorBillsPageComponent implements OnInit {
  public readonly app = inject(App);

  public ngOnInit(): void {
    this.app.activateRoutedPage('vendor-bills');
  }
}
