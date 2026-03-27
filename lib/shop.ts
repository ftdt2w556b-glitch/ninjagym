import { ShopCatalogItem } from "@/types";

export const SHOP_CATALOG: ShopCatalogItem[] = [
  {
    id: "tshirt_kids",
    name: "Kids T-Shirt",
    price: 300,
    options: { label: "Size", values: ["S", "M", "L", "XL"] },
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
];
