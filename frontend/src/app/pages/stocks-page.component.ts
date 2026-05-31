import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { App } from '../app';

@Component({
  selector: 'app-stocks-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './stocks-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StocksPageComponent implements OnInit, OnDestroy {
  public readonly app = inject(App);

  @ViewChild('stockImageInput')
  public set stockImageInputRef(ref: ElementRef<HTMLInputElement> | undefined) {
    this.app.setStockImageInput(ref?.nativeElement ?? null);
  }

  public ngOnInit(): void {
    this.app.activateRoutedPage('stocks');
  }

  public ngOnDestroy(): void {
    this.app.setStockImageInput(null);
  }
}
