import { ShopCatalogItem } from "@/types";

// Gift card denominations map to program prices
// Staff creates a member account for the recipient and issues a physical card
export const GIFT_CARD_PRICES: Record<string, number> = {
  "Unguided Climb Zone – ฿200":       200,
  "Group Session – ฿350":             350,
  "1-to-1 Session – ฿500":           500,
  "Combo Game & Train – ฿550":        550,
  "Day Camp – ฿555":                  555,
  "All Day Pass – ฿1,000":           1000,
  "Monthly Flex (30 days) – ฿6,000": 6000,
};

export const SHOP_CATALOG: ShopCatalogItem[] = [
  {
    id: "tshirt_kids",
    name: "Kids T-Shirt",
    price: 300,
    description: "Available in 3 designs — NinjaGym, SamuiKids, and Samui Ninja",
    options: {
      label: "Design & Size",
      groups: [
        { label: "NinjaGym",    values: ["NinjaGym – S",    "NinjaGym – M",    "NinjaGym – L",    "NinjaGym – XL"]    },
        { label: "SamuiKids",   values: ["SamuiKids – S",   "SamuiKids – M",   "SamuiKids – L",   "SamuiKids – XL"]   },
        { label: "Samui Ninja", values: ["Samui Ninja – S", "Samui Ninja – M", "Samui Ninja – L", "Samui Ninja – XL"] },
      ],
    },
  },
  {
    id: "tshirt_adult",
    name: "Adult T-Shirt",
    price: 300,
    options: { label: "Size", values: ["S", "M", "L", "XL"] },
  },
  {
    id: "shake_bake",
    name: "Shake and Bake",
    price: 200,
    description: "Includes: 1 Water, 1 Ice Cream Shake, 1 Grilled Cheese Toastie",
    options: {
      label: "Flavor",
      values: ["Vanilla", "Cookies and Cream", "Chocolate", "Strawberry"],
    },
  },
  {
    id: "water",
    name: "Water",
    price: 15,
    options: { label: "Size", values: ["Regular"] },
  },
  {
    id: "gift_card",
    name: "NinjaGym Gift Card",
    price: 0, // price driven by program selection
    description: "Give the gift of ninja training! Choose the program below — staff will set up a member account for your guest and provide a personalised card.",
    options: {
      label: "Program",
      values: Object.keys(GIFT_CARD_PRICES),
    },
  },
];

/** All physical (non-gift-card) catalog items that need inventory tracking */
export const INVENTORY_CATALOG_IDS = SHOP_CATALOG
  .filter((i) => i.id !== "gift_card")
  .map((i) => i.id);
