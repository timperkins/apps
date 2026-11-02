import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<h1>news-v2</h1><p>Running in ${import.meta.env.VITE_APP_ENV ?? 'dev'}.</p>`;
