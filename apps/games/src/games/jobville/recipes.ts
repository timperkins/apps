// Jobville: ingredients you gather and dishes you can cook for your menu.

export type Ing = 'wheat' | 'carrot' | 'pumpkin' | 'fish' | 'apple' | 'milk' | 'egg';

export const INGS: Record<Ing, { name: string; icon: string; where: string }> = {
  wheat: { name: 'Wheat', icon: '🌾', where: 'Harvest wheat on the farms' },
  carrot: { name: 'Carrot', icon: '🥕', where: 'Harvest carrots on the farms' },
  pumpkin: { name: 'Pumpkin', icon: '🎃', where: 'Harvest pumpkins on the farms' },
  fish: { name: 'Fish', icon: '🐟', where: 'Go fishing at the pond' },
  apple: { name: 'Apple', icon: '🍎', where: 'Pick apples from trees with red apples' },
  milk: { name: 'Milk', icon: '🥛', where: 'Collect at the barn by the farms' },
  egg: { name: 'Egg', icon: '🥚', where: 'Collect at the barn by the farms' },
};

export interface Recipe {
  id: string;
  name: string;
  icon: string;
  needs: Partial<Record<Ing, number>>;
  /** Kitchen item ids that can cook it. */
  at: string[];
  time: number;
  price: number;
}

const COUNTER = ['counter', 'cutting-board'];

export const RECIPES: Recipe[] = [
  { id: 'cooked-fish', name: 'Cooked Fish', icon: '🐟', needs: { fish: 1 }, at: ['oven'], time: 5, price: 18 },
  { id: 'grilled-fish', name: 'Grilled Fish', icon: '🍢', needs: { fish: 1 }, at: ['grill'], time: 4, price: 16 },
  { id: 'fish-chips', name: 'Fish & Chips', icon: '🍟', needs: { fish: 1, carrot: 1 }, at: ['fryer'], time: 6, price: 26 },
  { id: 'sushi', name: 'Sushi', icon: '🍣', needs: { fish: 1, wheat: 1 }, at: COUNTER, time: 3, price: 24 },
  { id: 'fish-taco', name: 'Fish Taco', icon: '🌮', needs: { fish: 1, wheat: 1, carrot: 1 }, at: ['grill'], time: 5, price: 28 },
  { id: 'bread', name: 'Bread', icon: '🍞', needs: { wheat: 2 }, at: ['oven'], time: 5, price: 10 },
  { id: 'popcorn', name: 'Popcorn', icon: '🍿', needs: { wheat: 1 }, at: ['stove'], time: 3, price: 7 },
  { id: 'carrot-soup', name: 'Carrot Soup', icon: '🍲', needs: { carrot: 2 }, at: ['stove'], time: 5, price: 12 },
  { id: 'salad', name: 'Salad', icon: '🥗', needs: { carrot: 1, pumpkin: 1 }, at: COUNTER, time: 2, price: 10 },
  { id: 'pumpkin-pie', name: 'Pumpkin Pie', icon: '🥧', needs: { pumpkin: 1, wheat: 1 }, at: ['oven'], time: 7, price: 22 },
  { id: 'veggie-burger', name: 'Veggie Burger', icon: '🍔', needs: { wheat: 1, carrot: 1, pumpkin: 1 }, at: ['grill'], time: 6, price: 24 },
  { id: 'apple-juice', name: 'Apple Juice', icon: '🧃', needs: { apple: 2 }, at: ['blender'], time: 3, price: 8 },
  { id: 'apple-tart', name: 'Apple Tart', icon: '🍏', needs: { apple: 2, wheat: 1 }, at: ['oven'], time: 6, price: 20 },
  { id: 'milkshake', name: 'Milkshake', icon: '🥤', needs: { milk: 1, apple: 1 }, at: ['blender'], time: 3, price: 14 },
  { id: 'ice-cream', name: 'Ice Cream', icon: '🍦', needs: { milk: 2 }, at: ['ice-cream-machine'], time: 4, price: 15 },
  { id: 'coffee', name: 'Coffee', icon: '☕', needs: { milk: 1 }, at: ['coffee-machine'], time: 3, price: 9 },
  { id: 'omelette', name: 'Omelette', icon: '🍳', needs: { egg: 2 }, at: ['stove'], time: 4, price: 14 },
  { id: 'pancakes', name: 'Pancakes', icon: '🥞', needs: { wheat: 1, egg: 1, milk: 1 }, at: ['stove'], time: 5, price: 20 },
  { id: 'cake', name: 'Cake', icon: '🎂', needs: { wheat: 2, egg: 1, milk: 1 }, at: ['oven'], time: 8, price: 30 },
  { id: 'pizza', name: 'Pizza', icon: '🍕', needs: { wheat: 2, milk: 1, carrot: 1 }, at: ['pizza-oven'], time: 7, price: 28 },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const MENU_MAX = 8;
export const STATIONS = new Set(RECIPES.flatMap((r) => r.at));
export const SEATS = new Set(['chair', 'table', 'stool', 'sofa']);
export const FUN_ITEMS = new Set(['sofa', 'tv', 'arcade', 'jukebox', 'fish-tank', 'game-console', 'pool-table', 'piano']);
