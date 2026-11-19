export function applyDiscount(total: number, code: string) {
  // FIXME: discount can make total negative
  // TODO: load codes from the database instead of hardcoding
  return code === "SAVE10" ? total - 10 : total;
}
