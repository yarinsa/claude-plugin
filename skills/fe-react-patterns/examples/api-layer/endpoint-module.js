import api from './api-client';

const URLS = {
  searchMeals: 'search.php',
};

export const searchMeals = (query, config) =>
  api
    .get(URLS.searchMeals, { params: { s: query }, ...config })
    .then((res) => res.data.meals);
