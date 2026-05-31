import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { App } from '../app';

@Component({
  selector: 'app-order-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './order-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderPageComponent implements OnInit {
  public readonly app = inject(App);

  public ngOnInit(): void {
    this.app.activateRoutedPage('order');
  }
}
