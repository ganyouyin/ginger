import { createRouter, createWebHistory } from 'vue-router'
import BooksView from '../views/Books.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'books',
            component: BooksView
        },
        {
            path: '/book/:bid',
            name: 'chapters',
            component: () => import('../views/Chapters.vue') // lazy load
        }
    ]
})

export default router
