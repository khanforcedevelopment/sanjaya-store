const ART: Record<string, string> = {
  mobiles: 'phone-gold', 'laptops-tablets': 'laptop-silver', electronics: 'headphones-gold', 'ethnic-wear': 'saree-crimson',
  sarees: 'saree-emerald', kurtis: 'kurti-rose', 'ethnic-dresses': 'dress-purple', men: 'shirt-sky', women: 'dress-rose',
  footwear: 'shoe-white', watches: 'watch-gold', bags: 'handbag-cognac', accessories: 'sunglasses-gold', 'home-lifestyle': 'lamp-mustard',
}
/** Fallback artwork for a category until the admin uploads a category image. */
export const categoryArt = (slug: string) => `/demo/${ART[slug] ?? 'handbag-gold'}.svg`
