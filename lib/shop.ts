import { ShopCatalogItem } from "@/types";

export const SHOP_CATALOG: ShopCatalogItem[] = [
  {
    id: "tshirt_kids",
    name: "Kids T-Shirt",
    price: 300,
    description: "Available in 3 designs — NinjaGym, SamuiKids, and Samui Ninja",
    options: {
      label: "Design & Size",
      groups: [
        { label: "NinjaGym", values: ["NinjaGym – S", "NinjaGym – M", "NinjaGym – L", "NinjaGym – XL"] },
        { label: "SamuiKids", values: ["SamuiKids – S", "SamuiKids – M", "SamuiKids – L", "SamuiKids – XL"] },
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
    id: "gift_card",
    name: "NinjaGym Gift Card",
    price: 0, // price is the denomination chosen
    description: "Give the gift of ninja training! Redeemable for any program — open play, memberships, birthdays, or day camps.",
    options: {
      label: "Value",
      groups: [
        {
          label: "Gift Card Value",
          values: ["500 THB", "1,000 THB", "1,500 THB", "2,000 THB"],
        },
      ],
    },
    // price override per denomination handled in shop page
  },
];

export const GIFT_CARD_PRICES: Record<string, number> = {
  "500 THB":   500,
  "1,000 THB": 1000,
  "1,500 THB": 1500,
  "2,000 THB": 2000,
};
