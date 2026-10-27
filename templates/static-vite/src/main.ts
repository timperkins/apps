import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<h1>__APP_NAME__</h1><p>Running in ${import.meta.env.VITE_APP_ENV ?? 'dev'}.</p>`;
