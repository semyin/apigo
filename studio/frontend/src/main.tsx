import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import {initI18n} from './i18n'
import { ToastProvider } from './components/ToastProvider'
import { DropdownProvider } from './components/template/DropdownContext'
import App from './App'

initI18n()

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <ToastProvider>
            <DropdownProvider>
                <App/>
            </DropdownProvider>
        </ToastProvider>
    </React.StrictMode>
)
