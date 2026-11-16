/** Paystack's hosted checkout. The browser is never sent anywhere else to pay. */
const PAYSTACK_CHECKOUT_HOST = "checkout.paystack.com";

export function isPaystackCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === PAYSTACK_CHECKOUT_HOST;
  } catch {
    return false;
  }
}

/** A full page load, so Paystack's page is not rendered inside RoomZA's router. */
export function sendBrowserToCheckout(url: string): void {
  window.location.assign(url);
}
