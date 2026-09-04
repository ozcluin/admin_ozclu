export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
];

export const getCurrencySymbol = (currencyCode?: string): string => {
  if (!currencyCode) return "$";
  const found = SUPPORTED_CURRENCIES.find(
    (c) => c.code.toUpperCase() === currencyCode.toUpperCase()
  );
  return found ? found.symbol : currencyCode;
};

export const formatCurrencyAmount = (amount: number, currencyCode?: string): string => {
  const symbol = getCurrencySymbol(currencyCode);
  const num = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  return `${symbol}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
