import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard-page.component').then((m) => m.DashboardPageComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin-page.component').then((m) => m.AdminPageComponent)
  },
  {
    path: 'statistics',
    loadComponent: () => import('./pages/statistics-page.component').then((m) => m.StatisticsPageComponent)
  },
  {
    path: 'stocks',
    loadComponent: () => import('./pages/stocks-page.component').then((m) => m.StocksPageComponent)
  },
  {
    path: 'client-bills',
    loadComponent: () => import('./pages/client-bills-page.component').then((m) => m.ClientBillsPageComponent)
  },
  {
    path: 'vendor-bills',
    loadComponent: () => import('./pages/vendor-bills-page.component').then((m) => m.VendorBillsPageComponent)
  },
  {
    path: 'order',
    loadComponent: () => import('./pages/order-page.component').then((m) => m.OrderPageComponent)
  },
  {
    path: '**',
    loadComponent: () => import('./pages/legacy-page-placeholder.component').then((m) => m.LegacyPagePlaceholderComponent)
  }
];
