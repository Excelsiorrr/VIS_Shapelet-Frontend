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
  },
  {
    path: '/match-locate',
    name: 'MatchLocatePanel',
    component: import('../views/PartC.vue')
  },
  {
    path: '/what-if',
    name: 'WhatIfPanel',
    component: import('../views/PartE.vue')
  },
  {
    path: '/part-c',
    redirect: '/match-locate'
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
