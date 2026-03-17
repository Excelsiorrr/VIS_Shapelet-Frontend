import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'DataPanel',
    component: import('../views/PartA.vue')
  },
  {
    path: '/shapelet-library',
    name: 'ShapeletLibraryPanel',
    component: import('../views/PartB.vue')
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
