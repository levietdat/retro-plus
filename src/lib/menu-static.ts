import { MenuSource } from "./constants";
import type { Menu, MenuCategory, MenuItem } from "./types";

/**
 * Menu copied from the KiotViet export. Used until the KiotViet API is connected
 * (MENU_SOURCE=kiotviet). Items that appeared twice with two prices are modelled as sizes L / M.
 */

enum Cat {
  Coffee = "coffee",
  MilkTea = "milktea",
  Matcha = "matcha",
  FruitTea = "fruittea",
  Yogurt = "yogurt",
  Juice = "juice",
  Bottled = "bottled",
  Other = "other",
}

enum Size {
  L = "L",
  M = "M",
  One = "",
}

const CATEGORIES: MenuCategory[] = [
  { id: Cat.Coffee, name: "Cà phê" },
  { id: Cat.MilkTea, name: "Trà sữa & Cacao" },
  { id: Cat.Matcha, name: "Matcha" },
  { id: Cat.FruitTea, name: "Trà trái cây" },
  { id: Cat.Yogurt, name: "Sữa chua" },
  { id: Cat.Juice, name: "Nước ép" },
  { id: Cat.Bottled, name: "Nước đóng chai" },
  { id: Cat.Other, name: "Khác" },
];

type Row = [id: string, name: string, cat: Cat, prices: Partial<Record<Size, number>>, tag?: string];

const ROWS: Row[] = [
  ["ca-phe-muoi", "Cà phê muối", Cat.Coffee, { [Size.One]: 25000 }, "Bán chạy"],
  ["ca-phe-kem-deo", "Cà phê kem dẻo Buôn Mê", Cat.Coffee, { [Size.One]: 25000 }],
  ["bac-xiu", "Cà phê bạc xỉu", Cat.Coffee, { [Size.One]: 25000 }],
  ["cf-sua-sg", "Cà phê sữa Sài Gòn", Cat.Coffee, { [Size.One]: 22000 }],
  ["cf-den-sg", "Cà phê đen Sài Gòn", Cat.Coffee, { [Size.One]: 20000 }],
  ["cf-sua-may", "Cà phê sữa pha máy", Cat.Coffee, { [Size.One]: 20000 }],
  ["cf-den-may", "Cà phê đen pha máy", Cat.Coffee, { [Size.One]: 18000 }],
  ["cf-sua-phin", "Cà phê sữa phin", Cat.Coffee, { [Size.One]: 18000 }],
  ["cf-den-phin", "Cà phê đen phin", Cat.Coffee, { [Size.One]: 16000 }],

  ["ts-retro", "Trà sữa Retro", Cat.MilkTea, { [Size.L]: 29000, [Size.M]: 24000 }, "Món nhà"],
  ["ts-socola", "Trà sữa Socola", Cat.MilkTea, { [Size.L]: 30000, [Size.M]: 25000 }],
  ["ts-tran-chau", "Trà Sữa Trân Châu Đường Đen", Cat.MilkTea, { [Size.One]: 25000 }],
  ["st-tran-chau", "Sữa Tươi Trân Châu Đường Đen", Cat.MilkTea, { [Size.One]: 25000 }],
  ["cacao", "Cacao", Cat.MilkTea, { [Size.L]: 30000, [Size.M]: 25000 }],

  ["matcha-latte", "Matcha Latte", Cat.Matcha, { [Size.One]: 30000 }],
  ["matcha-cold-whisk", "Matcha Cold Whisk", Cat.Matcha, { [Size.One]: 30000 }],

  ["tra-nhiet-doi", "Trà Trái Cây Nhiệt Đới", Cat.FruitTea, { [Size.One]: 25000 }],
  ["tra-dua-luoi", "Trà Dưa Lưới", Cat.FruitTea, { [Size.One]: 25000 }],
  ["tra-mang-cau", "Trà Mãng Cầu", Cat.FruitTea, { [Size.One]: 25000 }],
  ["tra-gung", "Trà gừng", Cat.FruitTea, { [Size.One]: 25000 }],
  ["tra-chanh", "Trà Chanh", Cat.FruitTea, { [Size.One]: 17000 }],
  ["nuoc-chanh", "Nước chanh", Cat.FruitTea, { [Size.One]: 20000 }],

  ["sc-viet-quat", "Sữa Chua Việt Quất", Cat.Yogurt, { [Size.One]: 22000 }],
  ["sc-dau", "Sữa Chua Dâu", Cat.Yogurt, { [Size.One]: 22000 }],
  ["sc-xoai", "Sữa Chua Xoài", Cat.Yogurt, { [Size.One]: 22000 }],
  ["sc-da", "Sữa Chua Đá", Cat.Yogurt, { [Size.One]: 20000 }],
  ["sc-hop", "Sữa chua hộp", Cat.Yogurt, { [Size.One]: 12000 }],

  ["ep-cam", "Nước Ép Cam", Cat.Juice, { [Size.One]: 25000 }],
  ["ep-dua", "Nước Ép Dứa (Thơm)", Cat.Juice, { [Size.One]: 25000 }],
  ["ep-ca-rot", "Nước Ép Cà Rốt", Cat.Juice, { [Size.One]: 25000 }],

  ["bo-huc", "Bò Húc", Cat.Bottled, { [Size.One]: 18000 }],
  ["bia-huda", "Bia Huda", Cat.Bottled, { [Size.One]: 16000 }],
  ["cocacola", "Cocacola", Cat.Bottled, { [Size.One]: 15000 }],
  ["sting", "Sting", Cat.Bottled, { [Size.One]: 15000 }],
  ["aquafina", "Nước suối Aquafina", Cat.Bottled, { [Size.One]: 10000 }],

  ["thuoc-la-sg", "Thuốc lá Sài Gòn", Cat.Other, { [Size.One]: 23000 }],
];

const SIZE_ORDER: Size[] = [Size.L, Size.M, Size.One];

function toItem([id, name, cat, prices, tag]: Row): MenuItem {
  return {
    id,
    name,
    categoryId: cat,
    tag,
    variants: SIZE_ORDER.filter((s) => prices[s] !== undefined).map((s) => ({
      id: s ? `${id}-${s.toLowerCase()}` : id,
      label: s,
      price: prices[s] as number,
    })),
  };
}

export function getStaticMenu(): Menu {
  return {
    source: MenuSource.Static,
    categories: CATEGORIES,
    items: ROWS.map(toItem),
    updatedAt: 0,
  };
}
