import './assets/main.css'

import { createApp } from 'vue'
import { init } from '@neutralinojs/lib'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import clickOutside from './directives/clickOutside'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.directive('click-outside', clickOutside)

app.mount('#app')

// Initialise NeutralinoJS after Vue mounts
init()
