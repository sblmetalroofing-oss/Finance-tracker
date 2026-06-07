// Product lookup for scanned barcodes.
// Resolution order: local price book (instant + offline) -> Open Food Facts -> manual entry.

const OFF_URL = "https://world.openfoodfacts.org/api/v2/product";

// Tidy a product name coming back from Open Food Facts.
function buildName(product) {
  const name = (product?.product_name || "").trim();
  const brand = (product?.brands || "").split(",")[0]?.trim();
  if (name && brand && !name.toLowerCase().includes(brand.toLowerCase())) {
    return `${brand} ${name}`;
  }
  return name || brand || "";
}

/**
 * Look up a scanned barcode.
 * @param {string} barcode
 * @param {object} priceBook - { [barcode]: { name, lastPrice, history } }
 * @returns {Promise<{ barcode, name, lastPrice: number|null, source: "priceBook"|"openfoodfacts"|"unknown" }>}
 */
export async function lookupBarcode(barcode, priceBook = {}) {
  const known = priceBook[barcode];
  if (known) {
    return {
      barcode,
      name: known.name || "",
      lastPrice: known.lastPrice ?? null,
      source: "priceBook",
    };
  }

  try {
    const res = await fetch(
      `${OFF_URL}/${encodeURIComponent(barcode)}.json?fields=product_name,brands`,
      { headers: { Accept: "application/json" } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.status === 1 || data?.product) {
        const name = buildName(data.product);
        if (name) {
          return { barcode, name, lastPrice: null, source: "openfoodfacts" };
        }
      }
    }
  } catch {
    // Offline or network error -> fall through to manual entry.
  }

  return { barcode, name: "", lastPrice: null, source: "unknown" };
}
