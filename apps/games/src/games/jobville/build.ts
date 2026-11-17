// Jobville: things you can build on your own lot, worker jobs, and names for applicants and rivals.

export type Layer = 'floor' | 'wall' | 'object';

export interface Item {
  id: string;
  name: string;
  icon: string;
  cat: string;
  price: number;
  /** Bricks it uses instead of (or as well as) money. */
  bricks: number;
  layer: Layer;
  solid: boolean;
  /** How much customers like it. */
  appeal: number;
  /** Things customers come to buy from. */
  sells: boolean;
  /** Wall and floor colours. */
  color?: string;
}

export const CATS = ['Walls', 'Floors', 'Kitchen', 'Food', 'Shop', 'Furniture', 'Work', 'Fun', 'Decor', 'Nature'] as const;
export const CAT_ICON: Record<string, string> = {
  Walls: '🧱', Floors: '🟫', Kitchen: '🍳', Food: '🍰', Shop: '🏪', Furniture: '🛋️', Work: '🧰', Fun: '🎮', Decor: '🎈', Nature: '🌷',
};

const items: Item[] = [];
function add(cat: string, layer: Layer, list: [string, string, number, number?][], opts: Partial<Item> = {}) {
  for (const [name, icon, price, appeal] of list) {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    items.push({
      id, name, icon, cat, price, bricks: 0, layer,
      solid: layer !== 'floor', appeal: appeal ?? Math.max(1, Math.round(price / 4)), sells: false, ...opts,
    });
  }
}

// Walls use bricks
items.push(
  { id: 'brick-wall', name: 'Brick Wall', icon: '🧱', cat: 'Walls', price: 0, bricks: 1, layer: 'wall', solid: true, appeal: 0, sells: false, color: '#b5523b' },
  { id: 'stone-wall', name: 'Stone Wall', icon: '🪨', cat: 'Walls', price: 0, bricks: 2, layer: 'wall', solid: true, appeal: 1, sells: false, color: '#8e8a84' },
  { id: 'wood-wall', name: 'Wood Wall', icon: '🪵', cat: 'Walls', price: 0, bricks: 1, layer: 'wall', solid: true, appeal: 1, sells: false, color: '#9a6a3a' },
  { id: 'white-wall', name: 'White Wall', icon: '⬜', cat: 'Walls', price: 0, bricks: 1, layer: 'wall', solid: true, appeal: 1, sells: false, color: '#f1ece2' },
  { id: 'pink-wall', name: 'Pink Wall', icon: '🩷', cat: 'Walls', price: 0, bricks: 1, layer: 'wall', solid: true, appeal: 1, sells: false, color: '#f19bbd' },
  { id: 'blue-wall', name: 'Blue Wall', icon: '🟦', cat: 'Walls', price: 0, bricks: 1, layer: 'wall', solid: true, appeal: 1, sells: false, color: '#5d8fd6' },
  { id: 'window', name: 'Window', icon: '🪟', cat: 'Walls', price: 0, bricks: 2, layer: 'wall', solid: true, appeal: 2, sells: false, color: '#a9dcf5' },
  { id: 'door', name: 'Door', icon: '🚪', cat: 'Walls', price: 0, bricks: 2, layer: 'wall', solid: false, appeal: 1, sells: false, color: '#7a4a26' },
  { id: 'gold-wall', name: 'Gold Wall', icon: '🟨', cat: 'Walls', price: 0, bricks: 5, layer: 'wall', solid: true, appeal: 4, sells: false, color: '#e5b927' },
  { id: 'fence', name: 'Fence', icon: '🚧', cat: 'Walls', price: 0, bricks: 1, layer: 'wall', solid: true, appeal: 0, sells: false, color: '#c9a36b' },
);

// Floors
for (const [name, color, price] of [
  ['Wood Floor', '#c99a62', 2], ['Tile Floor', '#e8e4dc', 2], ['Checker Floor', '#333', 3], ['Red Carpet', '#c0392b', 4],
  ['Blue Carpet', '#2f6fb3', 4], ['Green Carpet', '#3f9a52', 4], ['Marble Floor', '#f4f1ee', 6], ['Stone Floor', '#9d968c', 2],
  ['Pink Floor', '#f6b7cf', 3], ['Gold Floor', '#f0c838', 10],
] as [string, string, number][])
  items.push({ id: name.toLowerCase().replace(/ /g, '-'), name, icon: '🟫', cat: 'Floors', price, bricks: 0, layer: 'floor', solid: false, appeal: Math.ceil(price / 3), sells: false, color });

add('Kitchen', 'object', [
  ['Oven', '♨️', 60, 6], ['Stove', '🍳', 50, 5], ['Fridge', '🧊', 45, 3], ['Sink', '🚰', 25, 2], ['Mixer', '🥣', 30, 3],
  ['Pizza Oven', '🔥', 90, 8], ['Grill', '🍖', 55, 5], ['Fryer', '🍟', 50, 5], ['Coffee Machine', '☕', 70, 7],
  ['Toaster', '🍞', 20, 2], ['Microwave', '📦', 30, 2], ['Blender', '🥤', 25, 3], ['Ice Cream Machine', '🍦', 80, 8],
  ['Cutting Board', '🔪', 10, 1], ['Rolling Pin', '🥖', 8, 1], ['Pot', '🍲', 15, 2], ['Kettle', '🫖', 15, 2], ['Lunch Box', '🍱', 12, 2],
]);
add('Food', 'object', [
  ['Bread', '🍞', 10], ['Croissant', '🥐', 12], ['Cake', '🎂', 25], ['Cupcake', '🧁', 12], ['Donut', '🍩', 10],
  ['Cookie', '🍪', 8], ['Pie', '🥧', 18], ['Pizza', '🍕', 20], ['Burger', '🍔', 18], ['Hot Dog', '🌭', 14],
  ['Taco', '🌮', 14], ['Sushi', '🍣', 22], ['Ice Cream', '🍨', 15], ['Candy', '🍬', 6], ['Lollipop', '🍭', 6],
  ['Apples', '🍎', 6], ['Bananas', '🍌', 6], ['Cheese', '🧀', 10], ['Coffee', '☕', 8], ['Juice', '🧃', 6],
  ['Milk', '🥛', 6], ['Pancakes', '🥞', 14], ['Noodles', '🍜', 14], ['Watermelon', '🍉', 9], ['Popcorn', '🍿', 8],
], { sells: true });
add('Shop', 'object', [
  ['Money Box', '💰', 30, 0], ['Counter', '🟫', 25, 2], ['Shelf', '🗄️', 30, 3], ['Display Case', '🧊', 50, 5],
  ['Basket', '🧺', 10, 1], ['Shopping Cart', '🛒', 25, 2], ['Price Sign', '🏷️', 6, 1], ['Scale', '⚖️', 20, 2],
  ['Open Sign', '🪧', 10, 3], ['Gift Wrap', '🎁', 15, 2], ['Clothes Rack', '👕', 35, 4, ], ['Shoe Stand', '👟', 35, 4],
  ['Hat Stand', '🎩', 30, 3], ['Toy Shelf', '🧸', 40, 5], ['Book Stand', '📚', 30, 3], ['Flower Stand', '💐', 30, 4],
]);
add('Furniture', 'object', [
  ['Table', '🪑', 20], ['Chair', '💺', 10], ['Sofa', '🛋️', 45], ['Bed', '🛏️', 50], ['Lamp', '💡', 12],
  ['Bookshelf', '📚', 35], ['Desk', '🗃️', 30], ['TV', '📺', 60], ['Clock', '🕰️', 15], ['Mirror', '🪞', 20],
  ['Bathtub', '🛁', 60], ['Toilet', '🚽', 30], ['Wardrobe', '🚪', 40], ['Stool', '🪑', 8],
]);
add('Work', 'object', [
  ['Computer', '💻', 70], ['Printer', '🖨️', 40], ['Phone', '☎️', 20], ['Toolbox', '🧰', 30], ['Sewing Machine', '🧵', 50],
  ['Barber Chair', '💈', 60], ['Washing Machine', '🫧', 55], ['Microscope', '🔬', 70], ['Telescope', '🔭', 70],
  ['Paint Easel', '🎨', 35], ['Doctor Bed', '🩺', 60], ['Pet Bed', '🐾', 25], ['Car Lift', '🚗', 90], ['Anvil', '⚒️', 40],
  ['Camera', '📷', 45], ['Magic Hat', '🎩', 50],
]);
add('Fun', 'object', [
  ['Arcade', '🕹️', 90, 10], ['Piano', '🎹', 80, 8], ['Guitar', '🎸', 35, 4], ['Drums', '🥁', 50, 5], ['Ball Pit', '🟣', 70, 8],
  ['Slide', '🛝', 80, 9], ['Fish Tank', '🐠', 60, 7], ['Pool Table', '🎱', 70, 7], ['Jukebox', '🎵', 60, 7],
  ['Bouncy Castle', '🏰', 120, 12], ['Game Console', '🎮', 50, 5], ['Teddy Bear', '🧸', 15, 2],
]);
add('Decor', 'object', [
  ['Balloons', '🎈', 8], ['Painting', '🖼️', 25], ['Trophy', '🏆', 40], ['Star', '⭐', 15], ['Lights', '✨', 12],
  ['Gift', '🎁', 10], ['Statue', '🗿', 60], ['Disco Ball', '🪩', 45], ['Rainbow', '🌈', 30], ['Crystal', '🔮', 35],
  ['Candle', '🕯️', 6], ['Flag', '🚩', 6], ['Party Hat', '🥳', 8], ['Bell', '🔔', 8],
]);
add('Nature', 'object', [
  ['Potted Plant', '🪴', 12], ['Flowers', '🌷', 8], ['Sunflower', '🌻', 8], ['Cactus', '🌵', 10], ['Palm Tree', '🌴', 25],
  ['Little Tree', '🌳', 20], ['Rose Bush', '🌹', 12], ['Mushroom', '🍄', 6], ['Bonsai', '🎍', 30], ['Fountain', '⛲', 80],
]);

export const ITEMS = items;
export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(items.map((i) => [i.id, i]));

export interface Role {
  name: string;
  icon: string;
  /** Item ids that make this job earn double. */
  needs: string[];
}

export const ROLES: Role[] = [
  { name: 'Cashier', icon: '🧾', needs: ['money-box', 'counter'] },
  { name: 'Baker', icon: '🥐', needs: ['oven', 'mixer'] },
  { name: 'Chef', icon: '👨‍🍳', needs: ['stove', 'grill', 'fryer', 'pizza-oven'] },
  { name: 'Barista', icon: '☕', needs: ['coffee-machine'] },
  { name: 'Seller', icon: '🛍️', needs: ['shelf', 'display-case', 'clothes-rack', 'toy-shelf'] },
  { name: 'Cleaner', icon: '🧽', needs: ['sink', 'washing-machine'] },
  { name: 'Guard', icon: '💂', needs: ['door'] },
  { name: 'Ice Cream Maker', icon: '🍦', needs: ['ice-cream-machine'] },
  { name: 'Hairdresser', icon: '💇', needs: ['barber-chair'] },
  { name: 'Doctor', icon: '🩺', needs: ['doctor-bed'] },
  { name: 'Mechanic', icon: '🔧', needs: ['car-lift', 'toolbox'] },
  { name: 'Musician', icon: '🎵', needs: ['piano', 'guitar', 'drums'] },
  { name: 'Game Host', icon: '🕹️', needs: ['arcade', 'pool-table', 'game-console'] },
  { name: 'Manager', icon: '👔', needs: ['desk', 'computer'] },
];

export const NAMES = [
  'Mia', 'Leo', 'Ava', 'Max', 'Zoe', 'Sam', 'Lily', 'Jack', 'Emma', 'Noah', 'Ruby', 'Finn', 'Ella', 'Oscar', 'Nora', 'Theo',
  'Ivy', 'Milo', 'Luna', 'Eli', 'Rosie', 'Hugo', 'Maya', 'Otis', 'Pip', 'Juno', 'Ben', 'Cleo', 'Gus', 'Hazel',
];

export const LEVEL_TITLES = ['', 'Junior', 'Regular', 'Senior', 'Head', 'Super'];
