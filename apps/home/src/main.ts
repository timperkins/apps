import './style.css';
import { APPS } from './apps';

const list = document.querySelector<HTMLUListElement>('#apps')!;

for (const app of APPS) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = app.url;
  const name = document.createElement('strong');
  name.textContent = app.name;
  const blurb = document.createElement('span');
  blurb.textContent = app.blurb;
  const host = document.createElement('small');
  host.textContent = new URL(app.url).host;
  link.append(name, blurb, host);
  item.append(link);
  list.append(item);
}
