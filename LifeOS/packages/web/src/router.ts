import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'dashboard', component: () => import('./views/DashboardView.vue') },
  { path: '/timeline', name: 'timeline', component: () => import('./views/TimelineView.vue') },
  { path: '/calendar', name: 'calendar', component: () => import('./views/CalendarView.vue') },
  { path: '/inbox', name: 'inbox', component: () => import('./views/DimensionView.vue') },
  { path: '/dimension/:dimension', name: 'dimension', component: () => import('./views/DimensionView.vue') },
  { path: '/search', name: 'search', component: () => import('./views/SearchView.vue') },
  { path: '/stats', name: 'stats', component: () => import('./views/StatsView.vue') },
  { path: '/governance', name: 'governance', component: () => import('./views/GovernanceView.vue') },
  { path: '/governance/soul-action/:id', name: 'soul-action-detail', component: () => import('./views/SoulActionDetailView.vue') },
  { path: '/ops', name: 'ops', component: () => import('./views/OpsView.vue') },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
