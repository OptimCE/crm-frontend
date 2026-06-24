import { Routes } from '@angular/router';

import { NewsBoard } from './components/news-board/news-board';

export const NEWS_ROUTES: Routes = [
  {
    path: '',
    component: NewsBoard,
  },
];
