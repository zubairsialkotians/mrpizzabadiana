# Mr Pizza Badiana (shop app)

One online-shop app per store. Customers browse products by category, order with cash on delivery (or pickup), and track their orders. The store's owner and branch admins log in to the same app and get the admin screens: orders, items with photos, stock, returns, customers, expenses, reports, branches and settings.

The backend is `wp-content/themes/astra-child/function_shop_app_api.php` in **dailylifegoods**: REST namespace `shop/v1`, tables `wp_sa_*`. One API serves every store. Each store's copy of the app sends its own **shop key**, so customers, products, stock and orders never mix between stores. The same person can have accounts in two stores' apps.

## Set up a store

1. Upload `function_shop_app_api.php` (and the include line in `functions.php`) to the server. The tables are created automatically on the next page load.
2. Create the store in WP admin:
   - Go to **Users → Add New** and pick the role **Shop App Owner**.
   - Open their profile. Under **Shop App**, set the shop name, currency, status and paid-until date, and copy the **Shop key**.
   - **Users → Shop apps** lists every store.
3. Put the key in this app's `.env` as `EXPO_PUBLIC_SHOP_KEY`.
4. The owner logs in from **My account** with their WP email and password. Then they:
   - Fill in **Shop settings**: logo, phone, delivery charge, free-delivery amount, minimum order, open/closed.
   - Add **Categories**, then **Items** with photos and opening stock.
   - Add **Branches** if needed (each can get its own admin login).

Online orders go to the **main branch**. The owner can move a new order to another branch from the order page.

## Make an app for another store

Copy this folder and change only `.env` and the images in `assets/`:

| `.env` | What |
|---|---|
| `EXPO_PUBLIC_APP_NAME`, `APP_NAME` | Name on the phone and in the app |
| `EXPO_PUBLIC_SHOP_KEY` | From the store owner's WP profile |
| `EXPO_PUBLIC_PRIMARY_COLOR` | Brand colour, e.g. `#0f7a3d` |
| `APP_SLUG`, `APP_BUNDLE_ID` | Must be unique per app, e.g. `com.sialkotians.storename` |
| `EAS_PROJECT_ID` | From `npx eas-cli init` (push notifications) |

Replace `assets/icon.png`, `adaptive-icon.png` and `splash-icon.png` with the store's logo.

## Selling by weight / volume

On the item form, choose the unit (kg, litre, g, ml, pcs, …). Then tick the amounts customers can pick, such as 250 g, 500 g, 1 kg and 2 kg, and set the minimum and the − / + step.

For example, minimum 0.25 and step 0.25 (kg) lets customers buy 250 g, 500 g, 750 g, 1 kg and so on. Prices are per unit (Rs 400 / kg), and the line total is quantity × price. The server checks every quantity again.

## How things are counted

- **Stock** is taken when an order is **confirmed**. Cancelling after that puts it back.
- **Returns** can be recorded on delivered orders:
  - Items in good condition go back to stock.
  - Damaged items are a loss.
  - The refund is the price the items were sold at.
- **Profit & loss**:
  - Sales are the item totals of confirmed, out-for-delivery, ready and delivered orders.
  - Refunds are subtracted from sales.
  - Cost is the item's cost price when the order was confirmed, minus the cost of restocked returns.
  - Delivery charges are added and expenses subtracted.

## News

- The owner posts news from **Admin home → News**: a title, a message and an optional photo.
- When a post is published with **Send notification** on, every phone that has the app and allowed notifications gets a push. That includes guests who never logged in. Tapping the push opens the post.
- Customers see the news under the megaphone icon on the shop's home page. A red dot shows when there is news they haven't opened.
- A post can be hidden, edited or deleted. Editing a post doesn't send it again unless you switch **Send notification** back on.

## Accounts

- Customers register with name, phone, email, address and password. They log in with **phone or email**, and reset the password with a 6-digit code sent by email.
- **Guest checkout** asks for name, phone, email and address:
  - If no account matches those details, one is created and the customer is logged in on that phone. They can set a password later in My account.
  - If an account already matches the phone or email, the order is added to that account but the guest is **not** logged in (they log in with the password). The order can still be tracked on that phone.

## Run

```bash
npm install
npx expo start          # Expo Go (scan the QR) or press w for web
```
