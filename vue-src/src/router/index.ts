import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  // Hash mode required for NeutralinoJS static file serving
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
    },
    {
      path: '/deployments/new',
      name: 'deployment-new',
      component: () => import('../views/DeploymentFormView.vue'),
    },
    {
      path: '/deployments/:id',
      name: 'deployment-detail',
      component: () => import('../views/DeploymentDetailView.vue'),
    },
    {
      path: '/deployments/:id/edit',
      name: 'deployment-edit',
      component: () => import('../views/DeploymentFormView.vue'),
    },
    {
      path: '/deployments/:id/deploy',
      name: 'deployment-deploy',
      component: () => import('../views/DeployView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
    {
      path: '/release-tool',
      name: 'release-tool',
      component: () => import('../views/ReleaseToolView.vue'),
    },
    {
      path: '/devtools',
      name: 'devtools',
      component: () => import('../views/DevtoolsView.vue'),
    },
  ],
})

export default router
