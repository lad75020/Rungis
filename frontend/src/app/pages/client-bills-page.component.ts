import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { App } from '../app';

@Component({
  selector: 'app-client-bills-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './client-bills-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientBillsPageComponent implements OnInit {
  public readonly app = inject(App);

  public ngOnInit(): void {
    this.app.activateRoutedPage('client-bills');
  }
}
