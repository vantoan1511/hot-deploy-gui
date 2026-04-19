import './assets/main.css'
import 'primeicons/primeicons.css'

import { createApp } from 'vue'
import { init } from '@neutralinojs/lib'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import clickOutside from './directives/clickOutside'
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';

import ConfirmationService from 'primevue/confirmationservice';

// Initialise NeutralinoJS before Vue mounts to ensure APIs are ready
init()

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
    theme: {
        preset: Aura
    }
});
app.use(ConfirmationService);
app.directive('click-outside', clickOutside)

app.mount('#app')
