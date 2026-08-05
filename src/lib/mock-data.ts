const butterChicken = { url: "/products/butter-chicken.jpg" } as const;
const aluParatha = { url: "/products/alu-paratha.jpg" } as const;
const biryani = { url: "/products/biryani.avif" } as const;
const tandoori = { url: "/products/tandoori-chicken.jpg" } as const;
const samosa = { url: "/products/samosa.jpg" } as const;
const dosa = { url: "/products/masala-dosa.jpg" } as const;
const gulab = { url: "/products/gulab-jamun.jpg" } as const;
const naan = { url: "/products/naan-basket.jpg" } as const;
const thali = { url: "/products/thali-box.jpg" } as const;
const categoryHero = { url: "/uploads/category-hero.jpg" } as const;

// Breakfast item photos
const eggBhurji = { url: "/products/egg-bhurji-indian-style.jpeg" } as const;
const vegeScramble = { url: "/products/vege-shakahari-scrambled-egg.jpeg" } as const;
const plainScramble = { url: "/products/plain-scrambled-egg.jpeg" } as const;
const vegeOmelette = { url: "/products/vege-shakahari-omelette.jpeg" } as const;
const flamesOmelette = { url: "/products/flames-indian-style-omelette.jpeg" } as const;
const allCheesey = { url: "/products/all-cheesey-omelette.jpeg" } as const;
const plainOmelette = { url: "/products/plain-omelette.jpeg" } as const;
const tunaSandwich = { url: "/products/tuna-sandwich.jpeg" } as const;
const chickenSandwich = { url: "/products/chicken-sandwich.jpeg" } as const;
const eggCheeseSandwich = { url: "/products/egg-cheese-sandwich.jpeg" } as const;
const panCakes = { url: "/products/pan-cakes-3pc.jpeg" } as const;
const pavBhaji = { url: "/products/pav-bhaji.jpg" } as const;

export type Subcategory = { slug: string; name: string; categorySlug: string };

export type Category = {
  slug: string;
  name: string;
  description: string;
  image: string;
  heroImage: string;
  itemCount: number;
  isFeatured?: boolean;
  /** Slug of the category to pull "side dish" upsell items from on Cart/Checkout. */
  sideCategorySlug?: string | null;
  /** Availability state — controls product display on the category page. */
  availability?: "available" | "unavailable" | "upcoming";
};

export type AddonSize = { id: string; name: string; price: number };
export type AddonOption = { id: string; name: string; price: number; sizes?: AddonSize[]; emoji?: string };
export type AddonGroup = {
  id: string;
  name: string;
  type: "single" | "multi";
  required?: boolean;
  /** When true, options carry size-based pricing rendered as S/M/L price columns. */
  sized?: boolean;
  options: AddonOption[];
};

export type NutritionRow = { label: string; value: string };
export type NutritionInfo = { serving_size?: string; rows: NutritionRow[] };

export type ProductVariant = { id: number; name: string; price: number; isBase?: boolean };

export type Product = {
  slug: string;
  name: string;
  categorySlug: string;
  subcategorySlug?: string;
  description: string;
  longDescription: string;
  price: number;
  image: string;
  isVeg: boolean;
  isFeatured?: boolean;
  rating: number;
  addons?: AddonGroup[];
  nutrition?: NutritionInfo | null;
  productType?: "simple" | "variable";
  variants?: ProductVariant[];
};

export const HERO_BANNER = categoryHero.url;

export const categories: Category[] = [
  { slug: "breakfast", name: "Breakfast", description: "Start your day with our hearty, freshly-cooked breakfast plates.", image: eggBhurji.url, heroImage: categoryHero.url, itemCount: 13 },
  { slug: "lunch", name: "Lunch", description: "Quick, satisfying and flavorful meals designed for your midday break.", image: thali.url, heroImage: categoryHero.url, itemCount: 8 },
  { slug: "appetizers", name: "Appetizers", description: "Crispy, spicy starters to spark the appetite.", image: samosa.url, heroImage: categoryHero.url, itemCount: 6 },
  { slug: "dinner", name: "Dinner", description: "Rich curries, smoky tandoors and aromatic biryanis for the perfect evening.", image: butterChicken.url, heroImage: categoryHero.url, itemCount: 10 },
  { slug: "snacks-chaat-corner", name: "Snacks & Chaat Corner", description: "Crispy samosas, spicy chaats and street-style snacks.", image: samosa.url, heroImage: categoryHero.url, itemCount: 8 },
  { slug: "packaged-food", name: "Packaged Food", description: "Home-made jarred pickles, jams, sauces and more.", image: categoryHero.url, heroImage: categoryHero.url, itemCount: 0 },
];

export const subcategories: Subcategory[] = [
  { slug: "scrambled-egg", name: "SCRAMBLED EGG (3 EGGS)", categorySlug: "breakfast" },
  { slug: "omelette", name: "OMELETTE (3 EGGS)", categorySlug: "breakfast" },
  { slug: "bagel-sandwich", name: "Bagel Sandwich", categorySlug: "breakfast" },
  { slug: "pan-cakes", name: "PAN CAKES (3 pc)", categorySlug: "breakfast" },
  { slug: "pav-bhaji", name: "Pav Bhaji", categorySlug: "breakfast" },
];

// Standard à-la-carte add-on groups shared across breakfast plates
const breakfastAddons: AddonGroup[] = [
  {
    id: "bread",
    name: "Choice of Bread",
    type: "single",
    required: true,
    options: [
      { id: "white", name: "White Bread", price: 0 },
      { id: "wheat", name: "Whole Wheat Bread", price: 0 },
    ],
  },
  {
    id: "hot",
    name: "Hot Beverages",
    type: "multi",
    sized: true,
    options: [
      { id: "chai", name: "Masala Chai", price: 0, emoji: "🍵", sizes: [
        { id: "s", name: "Small", price: 2.99 },
        { id: "m", name: "Medium", price: 3.49 },
        { id: "l", name: "Large", price: 3.99 },
      ]},
      { id: "coffee", name: "Coffee", price: 0, emoji: "☕", sizes: [
        { id: "s", name: "Small", price: 2.49 },
        { id: "m", name: "Medium", price: 2.99 },
        { id: "l", name: "Large", price: 3.49 },
      ]},
      { id: "tea", name: "Plain Tea", price: 0, emoji: "🍃", sizes: [
        { id: "s", name: "Small", price: 1.99 },
        { id: "m", name: "Medium", price: 2.49 },
        { id: "l", name: "Large", price: 2.99 },
      ]},
    ],
  },
  {
    id: "smoothie",
    name: "Smoothies",
    type: "multi",
    sized: true,
    options: [
      { id: "strawberry", name: "Strawberry", price: 0, emoji: "🍓", sizes: [
        { id: "s", name: "Small", price: 4.99 },
        { id: "m", name: "Medium", price: 5.69 },
        { id: "l", name: "Large", price: 6.49 },
      ]},
      { id: "mango", name: "Mango", price: 0, emoji: "🥭", sizes: [
        { id: "s", name: "Small", price: 4.99 },
        { id: "m", name: "Medium", price: 5.69 },
        { id: "l", name: "Large", price: 6.49 },
      ]},
    ],
  },
];

export const products: Product[] = [
  // ----- Breakfast / Scrambled Egg -----
  {
    slug: "egg-bhurji-indian-style",
    name: "Egg Bhurji Indian Style",
    categorySlug: "breakfast",
    subcategorySlug: "scrambled-egg",
    description: "Contains Onion, Green Chilies and coriander. Served with Toast, Home Fries and Desert.",
    longDescription: "Contains Onion, Green Chilies and coriander. Served with Toast, Home Fries and Desert.",
    price: 9.99,
    image: eggBhurji.url,
    isVeg: false,
    rating: 4.8,
    addons: breakfastAddons,
  },
  {
    slug: "vege-shakahari-scrambled-egg",
    name: "Vege Shakahari Scrambled Egg",
    categorySlug: "breakfast",
    subcategorySlug: "scrambled-egg",
    description: "Scrambled eggs with bell peppers, onions and tomato. Served with Toast & Home Fries.",
    longDescription: "Scrambled eggs cooked with vibrant bell peppers, onions and tomato. Served with toast and seasoned home fries.",
    price: 9.99,
    image: vegeScramble.url,
    isVeg: false,
    rating: 4.7,
    addons: breakfastAddons,
  },
  {
    slug: "only-egg-scramble",
    name: "Only Egg Scramble",
    categorySlug: "breakfast",
    subcategorySlug: "scrambled-egg",
    description: "Classic creamy scrambled eggs. Served with Toast & Home Fries.",
    longDescription: "Soft, creamy scrambled eggs served with buttered toast and seasoned home fries.",
    price: 7.99,
    image: plainScramble.url,
    isVeg: false,
    rating: 4.6,
    addons: breakfastAddons,
  },
  // ----- Breakfast / Omelette -----
  {
    slug: "vege-shakahari-omelette",
    name: "VEGE SHAKAHARI",
    categorySlug: "breakfast",
    subcategorySlug: "omelette",
    description: "Omelette with bell peppers, onion and tomato.",
    longDescription: "A fluffy 3-egg omelette folded around bell peppers, onion and tomato. Served with toast and home fries.",
    price: 9.99,
    image: vegeOmelette.url,
    isVeg: false,
    rating: 4.7,
    addons: breakfastAddons,
  },
  {
    slug: "flames-indian-style-omelette",
    name: "FLAMES INDIAN STYLE",
    categorySlug: "breakfast",
    subcategorySlug: "omelette",
    description: "Spiced Indian masala omelette with onion, chilies and cilantro.",
    longDescription: "Our signature spiced omelette with onion, green chilies and cilantro. Served with toast and home fries.",
    price: 9.99,
    image: flamesOmelette.url,
    isVeg: false,
    rating: 4.9,
    addons: breakfastAddons,
  },
  {
    slug: "all-cheesey-omelette",
    name: "ALL CHEESEY",
    categorySlug: "breakfast",
    subcategorySlug: "omelette",
    description: "Three cheese omelette, melted and gooey.",
    longDescription: "Three-cheese omelette folded around a generous blend of melted cheeses. Served with toast and home fries.",
    price: 9.99,
    image: allCheesey.url,
    isVeg: false,
    rating: 4.8,
    addons: breakfastAddons,
  },
  {
    slug: "plain-omlette",
    name: "PLAIN OMLETTE",
    categorySlug: "breakfast",
    subcategorySlug: "omelette",
    description: "Classic plain omelette. Served with toast and home fries.",
    longDescription: "Light and fluffy plain 3-egg omelette, served with toast and seasoned home fries.",
    price: 7.99,
    image: plainOmelette.url,
    isVeg: false,
    rating: 4.5,
    addons: breakfastAddons,
  },
  // ----- Breakfast / Bagel Sandwich -----
  {
    slug: "tuna-salad-sandwich",
    name: "Tuna Salad Sandwich",
    categorySlug: "breakfast",
    subcategorySlug: "bagel-sandwich",
    description: "House-made tuna salad on toasted bread with home fries.",
    longDescription: "Our creamy house tuna salad on toasted bread, served with crisp home fries.",
    price: 9.99,
    image: tunaSandwich.url,
    isVeg: false,
    rating: 4.5,
    addons: breakfastAddons,
  },
  {
    slug: "chicken-salad-sandwich",
    name: "Chicken Salad Sandwich",
    categorySlug: "breakfast",
    subcategorySlug: "bagel-sandwich",
    description: "Chicken salad sandwich with lettuce, served with home fries.",
    longDescription: "Tender chicken salad layered with crisp lettuce on toasted bread, served with home fries.",
    price: 8.99,
    image: chickenSandwich.url,
    isVeg: false,
    rating: 4.6,
    addons: breakfastAddons,
  },
  {
    slug: "egg-cheese-sandwich",
    name: "Egg & Cheese Sandwich",
    categorySlug: "breakfast",
    subcategorySlug: "bagel-sandwich",
    description: "Egg & cheese bagel sandwich with home fries.",
    longDescription: "Soft egg and melted cheese on a toasted bagel, served with crisp home fries.",
    price: 7.99,
    image: eggCheeseSandwich.url,
    isVeg: false,
    rating: 4.6,
    addons: breakfastAddons,
  },
  // ----- Breakfast / Pan Cakes -----
  {
    slug: "pan-cakes-3pc",
    name: "PAN CAKES (3 pc)",
    categorySlug: "breakfast",
    subcategorySlug: "pan-cakes",
    description: "Topped with fresh fruits: Strawberry, banana, blueberries with choice of maple, strawberry or chocolate syrup.",
    longDescription: "Three fluffy buttermilk pancakes topped with strawberries, banana and blueberries. Served with your choice of maple, strawberry or chocolate syrup.",
    price: 8.99,
    image: panCakes.url,
    isVeg: true,
    rating: 4.8,
    addons: [
      {
        id: "syrup",
        name: "Choice of Syrup",
        type: "single",
        required: true,
        options: [
          { id: "maple", name: "Maple Syrup", price: 0 },
          { id: "strawberry", name: "Strawberry Syrup", price: 0 },
          { id: "chocolate", name: "Chocolate Syrup", price: 0 },
        ],
      },
      breakfastAddons[1], // shared sized Hot Beverages group
      breakfastAddons[2], // shared sized Smoothies group
    ],
  },
  // ----- Breakfast / Pav Bhaji -----
  {
    slug: "pav-bhaji",
    name: "Pav Bhaji",
    categorySlug: "breakfast",
    subcategorySlug: "pav-bhaji",
    description: "Served with two pavs and bhaji.",
    longDescription: "Mumbai-style spiced mashed vegetable curry topped with butter, onion and cilantro, served with two toasted buttered pav buns.",
    price: 8.99,
    image: pavBhaji.url,
    isVeg: true,
    rating: 4.8,
    addons: [breakfastAddons[1], breakfastAddons[2]],
  },

  // ----- Other categories (stub items so cards exist) -----
  { slug: "masala-dosa", name: "Masala Dosa", categorySlug: "lunch", description: "Crispy rice crepe with spiced potato.", longDescription: "South Indian classic — paper-thin fermented crepe rolled around a savory potato masala, served with sambar & chutneys.", price: 12.5, image: dosa.url, isVeg: true, rating: 4.9 },
  { slug: "aloo-paratha", name: "Aloo Paratha", categorySlug: "lunch", description: "Flatbread stuffed with spiced potatoes.", longDescription: "Hand-rolled whole-wheat parathas stuffed with cumin-spiced potatoes, griddled in ghee.", price: 8.5, image: aluParatha.url, isVeg: true, rating: 4.7 },
  { slug: "paneer-tikka-thali", name: "Paneer Tikka Thali", categorySlug: "lunch", description: "Complete vegetarian thali.", longDescription: "Grilled paneer tikka, yellow dal, jeera rice, vegetable curry, naan and salad.", price: 14.0, image: thali.url, isVeg: true, rating: 4.7 },
  { slug: "butter-chicken", name: "Butter Chicken", categorySlug: "dinner", description: "Tandoor chicken in silky tomato-cream gravy.", longDescription: "Tender pieces of charcoal-grilled chicken simmered in our signature tomato-fenugreek cream gravy.", price: 18.99, image: butterChicken.url, isVeg: false, rating: 4.9 },
  { slug: "hyderabadi-biryani", name: "Hyderabadi Chicken Biryani", categorySlug: "dinner", description: "Saffron basmati with marinated chicken.", longDescription: "Long-grain basmati layered with spiced chicken and sealed dum-style.", price: 16.5, image: biryani.url, isVeg: false, rating: 4.9 },
  { slug: "garlic-naan", name: "Garlic Naan", categorySlug: "dinner", description: "Tandoor flatbread with garlic butter.", longDescription: "Soft blistered naan brushed with garlic-cilantro butter.", price: 3.5, image: naan.url, isVeg: true, rating: 4.8 },
  { slug: "tandoori-chicken", name: "Tandoori Chicken", categorySlug: "appetizers", description: "Yogurt-marinated tandoor chicken.", longDescription: "Bone-in chicken marinated overnight, charred in a 500°F tandoor.", price: 15.0, image: tandoori.url, isVeg: false, rating: 4.8 },
  { slug: "vegetable-samosa", name: "Vegetable Samosa (2 pc)", categorySlug: "appetizers", description: "Pastry pockets with spiced potatoes & peas.", longDescription: "Flaky hand-folded pastry pockets stuffed with cumin potatoes and peas.", price: 5.5, image: samosa.url, isVeg: true, rating: 4.6 },
  { slug: "gulab-jamun", name: "Gulab Jamun (3 pc)", categorySlug: "dinner", description: "Warm milk dumplings in saffron syrup.", longDescription: "Soft khoya dumplings soaked in saffron-cardamom syrup.", price: 4.5, image: gulab.url, isVeg: true, rating: 4.9 },
];

export const testimonials = [
  { name: "Michael Anderson", role: "Regular Customer", quote: "Fresh ingredients, rich flavors and quick service. The restaurant delivers quality consistently and never disappoints." },
  { name: "Priya Sharma", role: "Food Blogger", quote: "Hands down the most authentic Indian flavors I've had in Canada. The biryani is unreal." },
  { name: "Jonathan Lee", role: "Office Lunch Regular", quote: "My go-to lunch spot. The thali boxes are generous, fresh and packed with flavor every time." },
];
