import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { App } from '../app';

@Component({
  selector: 'app-statistics-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './statistics-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatisticsPageComponent implements OnInit {
  public readonly app = inject(App);

  public ngOnInit(): void {
    this.app.activateRoutedPage('statistics');
  }
}
