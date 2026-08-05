import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Subtopic = { id: string; title: string; body: React.ReactNode };
type Topic = { id: string; title: string; intro?: React.ReactNode; subtopics: Subtopic[] };

const TOPICS: Topic[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    intro: (
      <>
        <p>
          Welcome to Flames Gourmet! This manual walks you through the customer-facing site and the
          admin panel in detail. Use the collapsible navigation on the left to jump to a topic, or
          scroll through the full guide.
        </p>
        <p>
          The site has two surfaces: the public storefront (browsing, ordering, account) and the
          admin panel at <code>/admin</code> (orders, menu, media, promotions, SEO and settings).
          Both are responsive and work on phone, tablet and desktop.
        </p>
      </>
    ),
    subtopics: [
      {
        id: "gs-account",
        title: "Creating an account",
        body: (
          <>
            <p>
              Click the user icon in the top-right header and choose <strong>Sign up</strong>. You
              will be asked for your name, email, phone and a password. Passwords must be at least
              8 characters.
            </p>
            <p>
              After signing up, a confirmation message appears and you are signed in automatically.
              Your avatar replaces the user icon — click it to access your profile, orders, and to
              sign out.
            </p>
            <p>
              Accounts unlock pre-orders, saved addresses, faster checkout and an order history.
              Guest checkout is also supported for one-off orders.
            </p>
          </>
        ),
      },
      {
        id: "gs-signin",
        title: "Signing in",
        body: (
          <>
            <p>
              Use the user icon and choose <strong>Sign in</strong>. Enter your email and password.
              If you forgot your password, use the <strong>Forgot password</strong> link and a reset
              email will be sent to you.
            </p>
            <p>
              Once signed in, the user menu shows shortcuts to <strong>Profile</strong>,{" "}
              <strong>My Orders</strong> and <strong>Sign out</strong>.
            </p>
          </>
        ),
      },
      {
        id: "gs-profile",
        title: "Managing your profile",
        body: (
          <>
            <p>
              From the user menu, open <strong>Profile</strong>. Here you can update your display
              name, phone number, default delivery address and upload a profile picture. The
              picture replaces the user icon in the header on every page.
            </p>
            <p>
              You can also opt in or out of the email newsletter from this page. Changes are saved
              immediately after clicking <strong>Save</strong>.
            </p>
          </>
        ),
      },
      {
        id: "gs-newsletter",
        title: "Subscribing to the newsletter",
        body: (
          <p>
            Use the newsletter form in the footer, or enable the subscription toggle in your
            profile. We send occasional updates about new menu items, promotions and seasonal
            specials — no spam, and you can unsubscribe from any email.
          </p>
        ),
      },
    ],
  },
  {
    id: "browsing",
    title: "Browsing the Menu & Shop",
    subtopics: [
      {
        id: "br-menu",
        title: "Menu page",
        body: (
          <>
            <p>
              The <strong>Menu</strong> page lists all food categories with a hero cover image and
              short description. Click a category to open it and see all items belonging to it,
              grouped by subcategory when applicable.
            </p>
            <p>
              Each product card shows the item image, name, short description and starting price.
              Click the card to open the full product page with detailed description, variants,
              add-ons and nutritional information when available.
            </p>
          </>
        ),
      },
      {
        id: "br-shop",
        title: "Shop page",
        body: (
          <p>
            The <strong>Shop</strong> page features the <strong>Packaged Food</strong> category —
            bottled sauces and gourmet items that can be ordered for in-store pickup. The hero
            banner on this page is the cover image of the Packaged Food category, so updating that
            category image will automatically update the Shop hero.
          </p>
        ),
      },
      {
        id: "br-search",
        title: "Search, sort and filter",
        body: (
          <>
            <p>
              Use the search icon in the header to open a full-screen search box that searches
              products across the whole site. As you type, matching items appear instantly.
            </p>
            <p>On any category page you can also:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Search items by name within the category</li>
              <li>Filter by subcategory (e.g. Veg / Non-veg, Small / Large)</li>
              <li>Filter by dietary preference (veg, vegan, gluten-free, etc.)</li>
              <li>Sort by price (low → high or high → low), name, or popularity</li>
            </ul>
            <p>All controls persist while you scroll so you can refine without losing your place.</p>
          </>
        ),
      },
      {
        id: "br-availability",
        title: "Category availability",
        body: (
          <>
            <p>
              Categories have one of three availability states set in the admin:
              <strong> Available</strong>, <strong>Upcoming</strong> or{" "}
              <strong>Unavailable</strong>.
            </p>
            <p>
              When a category is <em>Upcoming</em>, the page shows a notice that reads{" "}
              <em>"Items in this category will be available soon. Stay tuned!"</em> and the title is
              suffixed with <em>(Coming Soon)</em>.
            </p>
            <p>
              When a category is <em>Unavailable</em>, the notice reads{" "}
              <em>"Items in this category are currently unavailable. Please check back later."</em>{" "}
              and the title is suffixed with <em>(Unavailable)</em>. Items are still visible but
              ordering may be disabled.
            </p>
          </>
        ),
      },
      {
        id: "br-product",
        title: "Product page details",
        body: (
          <p>
            Each product page shows full-size imagery, a long description, available variants
            (e.g. size, spice level), add-ons (extra cheese, side of rice), allergen notes and a
            quantity selector. Add the item directly to your cart from this page.
          </p>
        ),
      },
    ],
  },
  {
    id: "ordering",
    title: "Placing an Order",
    subtopics: [
      {
        id: "or-cart",
        title: "Adding items to the cart",
        body: (
          <>
            <p>
              Click <strong>Add to Cart</strong> on any product. For items with options (size,
              add-ons, spice level), select your variant first; the price updates accordingly. The
              cart icon in the header shows the live item count.
            </p>
            <p>
              Open the cart at any time from the header. Adjust quantities with the + / − buttons,
              or remove an item with the trash icon. Subtotal, tax and total update in real time.
            </p>
          </>
        ),
      },
      {
        id: "or-checkout",
        title: "Checking out",
        body: (
          <>
            <p>
              From the cart, click <strong>Checkout</strong>. Provide your contact information and
              pickup/delivery preference, choose a payment method, and review the totals.
            </p>
            <p>
              <strong>Important:</strong> For online orders, <em>Cash on Delivery</em> is disabled —
              only online payment is available. COD is only offered for counter orders created from
              the admin <strong>Create Order</strong> page.
            </p>
          </>
        ),
      },
      {
        id: "or-preorder",
        title: "Pre-orders",
        body: (
          <>
            <p>
              Signed-in customers can schedule a pre-order for a future date and time. Pick the
              date and time on the checkout page; the system validates that the slot is within
              business hours and the kitchen's lead time.
            </p>
            <p>
              Pre-orders only appear on the kitchen's <code>/current-orders</code> screen{" "}
              <strong>30 minutes before</strong> the scheduled time, so the kitchen isn't flooded
              with future tickets.
            </p>
          </>
        ),
      },
      {
        id: "or-coupons",
        title: "Applying coupons",
        body: (
          <p>
            Enter a coupon code in the cart or at checkout. Valid discounts are applied to the
            subtotal <em>before</em> tax. The breakdown is visible on the order confirmation and in
            your order history.
          </p>
        ),
      },
      {
        id: "or-auto-cancel",
        title: "Unpaid order auto-cancellation",
        body: (
          <>
            <p>
              Online orders that remain unpaid for <strong>30 minutes</strong> are automatically
              cancelled. A background sweeper runs every minute, so cancellation lands within ~1
              minute of hitting the 30-minute mark.
            </p>
            <p>
              Counter orders created from the admin panel are excluded from auto-cancellation —
              staff can mark them paid at their pace.
            </p>
          </>
        ),
      },
      {
        id: "or-track",
        title: "Tracking your order",
        body: (
          <>
            <p>
              Visit <strong>My Orders</strong> from the user menu to see all your orders with status
              (Pending, Confirmed, Ready, Completed, Cancelled), totals and a detailed line-item
              breakdown.
            </p>
            <p>
              The total amount shown is the grand total:{" "}
              <code>(subtotal − discount) + tax</code>. Hover over the total to see each component
              separately.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "delivery-tracking",
    title: "Delivery, Tracking & Payments",
    intro: (
      <p>
        Flames Gourmet supports both in-store pickup and courier delivery via
        Uber Direct, with a public tracking page and richer payment handling
        (cash change, per-order packaging fees, persisted delivery fees).
      </p>
    ),
    subtopics: [
      {
        id: "dt-toggle",
        title: "Pickup vs Delivery at checkout",
        body: (
          <>
            <p>
              The checkout page has a <strong>Pickup / Delivery</strong> toggle.
              Pickup is free and uses the store address. Delivery reveals an
              address field with live suggestions (powered by Photon) and, once
              a valid address is chosen, fetches a live delivery quote from
              Uber Direct.
            </p>
            <p>
              A delivery <strong>packaging fee</strong> configured in Settings
              is added to delivery orders and appears on all receipts.
            </p>
          </>
        ),
      },
      {
        id: "dt-address",
        title: "Address autocomplete & normalization",
        body: (
          <p>
            Address suggestions come from the free Photon API — start typing
            and pick a match to capture latitude and longitude for the delivery
            quote. Common typos like <code>MIE 4A9</code> are auto-corrected to{" "}
            <code>M1E 4A9</code>, and noise words such as <em>"Put"</em> or{" "}
            <em>"Apt"</em> are stripped before geocoding.
          </p>
        ),
      },
      {
        id: "dt-dispatch",
        title: "Dispatch on payment",
        body: (
          <>
            <p>
              When you mark a delivery order as <strong>Paid</strong> in the
              admin, the system automatically dispatches it to Uber Direct.
              The order refreshes immediately so the courier info (Delivery ID
              and live tracking link) appears without a reload.
            </p>
            <p>
              During testing with live keys, dispatches are sent with{" "}
              <code>is_draft: true</code> so no driver is actually assigned.
            </p>
          </>
        ),
      },
      {
        id: "dt-tracking",
        title: "Live tracking & Track Order page",
        body: (
          <>
            <p>
              Customers can visit the <strong>/track</strong> page (linked from
              the footer and mobile nav) and look up an order by number, name,
              phone or address. Placing an order redirects here automatically.
            </p>
            <p>
              Every delivery order view — admin modal, customer order details,
              and the track page — shows a prominent{" "}
              <strong>Open live tracking</strong> button plus the Delivery ID.
              The map is embedded via Leaflet.
            </p>
          </>
        ),
      },
      {
        id: "dt-fee",
        title: "Delivery fee persistence",
        body: (
          <p>
            The quoted delivery fee is saved on the order at checkout time in{" "}
            <code>delivery_fee_cents</code>, so the amount stays consistent in
            every view — modal, receipt, tracking page — even before the
            courier is dispatched.
          </p>
        ),
      },
      {
        id: "dt-cash",
        title: "Cash Received & change",
        body: (
          <>
            <p>
              On <strong>Create Order</strong>, when the payment method is
              Cash, a <strong>Cash Received</strong> input appears. The system
              calculates and displays the <strong>Change</strong> in real time,
              and both values are saved with the order.
            </p>
            <p>
              Cash Received and Change appear on the thermal receipt, in the
              order details modal and on the customer's order view.
            </p>
          </>
        ),
      },
      {
        id: "dt-order-type",
        title: "Order Type column",
        body: (
          <p>
            The admin orders list shows an <strong>Order Type</strong> column.
            Counter orders show <em>To Stay</em> or <em>To Go</em>; online
            orders show <em>Pickup</em> or <em>Delivery</em>. The{" "}
            <em>Punched by</em> line is hidden for online orders since those
            are placed directly by the customer.
          </p>
        ),
      },
      {
        id: "dt-uber-keys",
        title: "Uber Direct settings (Sandbox / Live)",
        body: (
          <>
            <p>
              In <strong>Settings → Delivery</strong>, you can save separate
              <strong> Sandbox</strong> and <strong>Live</strong> Uber Direct
              credentials and flip the environment toggle. The backend
              resolves the correct set of keys automatically for each request.
            </p>
            <p>
              A pickup address is required even if it's also set inside the
              Uber portal, because Uber's API expects it on every quote.
            </p>
          </>
        ),
      },
    ],
  },

  {
    id: "admin-basics",
    title: "Admin Panel Basics",
    subtopics: [
      {
        id: "ad-login",
        title: "Signing in to admin",
        body: (
          <p>
            Open <code>/admin/login</code> and use your admin credentials. Authentication is
            separate from customer accounts. After signing in you land on the admin dashboard;
            permissions are role-based so you only see the sections you have access to.
          </p>
        ),
      },
      {
        id: "ad-nav",
        title: "Navigation & layout",
        body: (
          <>
            <p>
              The left sidebar lists every section you have access to. The sidebar is scrollable
              and has padded top/bottom space so the OS task bar never hides the logout or visit
              site links.
            </p>
            <p>
              Super admins can drag-and-drop items in the sidebar to reorder them; the new order is
              saved per user.
            </p>
          </>
        ),
      },
      {
        id: "ad-roles",
        title: "Roles & permissions",
        body: (
          <>
            <p>Available roles:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Super Admin</strong> — full access including user management</li>
              <li><strong>Admin</strong> — full access except destructive user operations</li>
              <li><strong>Kitchen Manager</strong> — current orders only, no view-order details</li>
              <li><strong>Counter Sales</strong> — Create Order and view orders</li>
              <li><strong>Store Manager</strong> — menu, media, inventory, reports</li>
              <li><strong>SEO Manager</strong> — SEO tools and page content</li>
            </ul>
            <p>
              Permissions are managed in <strong>Users → Roles</strong>. New admin pages added to
              the system appear automatically in role permissions, so no code change is needed when
              a new page ships.
            </p>
          </>
        ),
      },
      {
        id: "ad-password",
        title: "Changing your password",
        body: (
          <p>
            Super admins can change their password under <strong>Change password</strong>. Other
            users should ask a super admin to reset their credentials from{" "}
            <strong>Users</strong>.
          </p>
        ),
      },
      {
        id: "ad-xpert",
        title: "Xpert AI assistant",
        body: (
          <>
            <p>
              <strong>Xpert</strong> is the friendly chat bubble in the bottom-right of every
              admin page (admins and super admins only). Ask it how to do something — create a
              coupon, build an offer, take a counter order — and it walks you through the exact
              menu path step by step.
            </p>
            <p>
              Tap the microphone icon to dictate your question by voice. Xpert is advisory only
              and never edits your data directly.
            </p>
          </>
        ),
      },
      {
        id: "ad-feedback",
        title: "Help & Feedback buttons",
        body: (
          <p>
            The header has a <strong>Help</strong> button (this page) and a{" "}
            <strong>Feedback</strong> button. Feedback opens a rich-text editor and emails your
            message straight to the site owner.
          </p>
        ),
      },
      {
        id: "ad-virtual-kb",
        title: "Virtual keyboard (touch mode)",
        body: (
          <>
            <p>
              The Order panel on <strong>Create Order</strong> has a{" "}
              <strong>Virtual Keyboard</strong> checkbox in the top-right. Turn
              it on to make every input field open a touch-friendly on-screen
              pad — a QWERTY keyboard for text and a numeric pad for money and
              phone fields. Physical typing still works either way.
            </p>
            <p>
              The choice is remembered per browser. Amount fields also expose
              quick-add chips (+5, +10, exact) for fast cash entry.
            </p>
          </>
        ),
      },

    ],
  },
  {
    id: "admin-orders",
    title: "Managing Orders",
    subtopics: [
      {
        id: "od-list",
        title: "Orders list",
        body: (
          <>
            <p>
              The <strong>Orders</strong> page lists all orders with date/time, customer, items
              count, payment status and the grand total (<code>subtotal − discount + tax</code>).
              Hover the total to see a tooltip with the full breakdown.
            </p>
            <p>
              The list auto-refreshes every <strong>5 seconds</strong> so new orders appear without
              reloading. A <strong>Refresh</strong> button above the table lets you trigger a
              manual reload.
            </p>
            <p>
              Click any order row to open the full order detail with line items, modifications,
              applied coupon and payment information. Kitchen managers do not see the view-order
              option.
            </p>
          </>
        ),
      },
      {
        id: "od-current",
        title: "Kitchen / Current Orders",
        body: (
          <>
            <p>
              <code>/current-orders</code> shows tickets ready for the kitchen, sorted by oldest
              first. Each ticket shows items, modifications, allergens and the customer's pickup
              time.
            </p>
            <p>
              Pre-orders are hidden from this screen until <strong>30 minutes before</strong> their
              scheduled time, so the kitchen always sees only what's actionable now.
            </p>
          </>
        ),
      },
      {
        id: "od-create",
        title: "Counter orders (Create Order)",
        body: (
          <>
            <p>
              Use <strong>Create Order</strong> for in-person counter sales. Categories appear in a
              hierarchical sidebar — click a category to expand its subcategories, and click a
              subcategory to filter products to just that group.
            </p>
            <p>
              Product images on this page are always in sync with the latest uploads. The page
              polls every 30 seconds, refreshes on tab focus, and the backend invalidates image
              caches whenever a product image is updated.
            </p>
            <p>
              Cash on Delivery is available here even though it's disabled for online checkout, so
              staff can accept cash at the counter.
            </p>
          </>
        ),
      },
      {
        id: "od-view",
        title: "Frontend My Orders",
        body: (
          <p>
            Customers view their own orders at <code>/orders</code>. The total column matches the
            admin view (subtotal − discount + tax) and supports the same breakdown tooltip.
          </p>
        ),
      },
      {
        id: "od-edit",
        title: "Editing orders (pencil icon)",
        body: (
          <>
            <p>
              Both the admin <strong>Orders</strong> list and the customer{" "}
              <code>/orders</code> page expose a pencil icon on each row that
              opens the shared <strong>Edit Order</strong> dialog. From here
              you can adjust quantities, unit prices, notes and add new line
              items.
            </p>
            <p>
              When you type into the item name field on a new row, matching
              menu items appear with their prices — pick one and the name and
              unit price are filled automatically.
            </p>
          </>
        ),
      },
      {
        id: "od-shared-templates",
        title: "Shared receipt & modal templates",
        body: (
          <p>
            Order totals, labels, thermal receipts and the details modal are
            rendered from a single shared source, so the admin view, customer
            view, printed receipt and owner email always agree — no drift when
            fees, discounts, cash-received or delivery info change.
          </p>
        ),
      },

    ],
  },
  {
    id: "admin-menu",
    title: "Menu Management",
    subtopics: [
      {
        id: "mn-products",
        title: "Adding products",
        body: (
          <>
            <p>
              Go to <strong>Menu → Food Items</strong> (or <strong>Packaged Food</strong>) and click{" "}
              <strong>Add</strong>. Fill in the title, description, price and choose a category
              (required). Optional fields include subcategory, dietary tags, allergens and
              nutritional info.
            </p>
            <p>
              The <strong>slug</strong> field is optional — leave it blank and a URL-safe slug is
              generated from the title automatically. The placeholder shows what will be generated.
            </p>
            <p>
              Upload a product image from your device or pick one from the Media library. Uploads
              from device are automatically converted to AVIF; the original is removed and the
              converted file is what's stored.
            </p>
          </>
        ),
      },
      {
        id: "mn-variants",
        title: "Product variants & add-ons",
        body: (
          <p>
            Products can have multiple <strong>variants</strong> (e.g. Small, Large) each with its
            own price, and <strong>add-ons</strong> (extra cheese, dipping sauce). Variants and
            add-ons are managed inline on the product editor.
          </p>
        ),
      },
      {
        id: "mn-duplicate",
        title: "Duplicating products",
        body: (
          <p>
            Each product row has a <strong>Duplicate</strong> icon. Click it to clone the product
            with all its variants, add-ons and images; the new copy opens in edit mode so you can
            adjust the title, price or description before saving.
          </p>
        ),
      },
      {
        id: "mn-price",
        title: "Inline price editing",
        body: (
          <p>
            Click on a product price in the list to edit it inline — a small input appears, type
            the new value and press Enter. A tooltip "Click to edit" is shown on hover so the
            interaction is discoverable.
          </p>
        ),
      },
      {
        id: "mn-cats",
        title: "Categories & subcategories",
        body: (
          <>
            <p>
              Slugs for categories and subcategories are optional and will be derived from the
              name. Each category can have a cover image, description and an availability state.
            </p>
            <p>
              The categories table has an inline <strong>Availability</strong> column. Pick{" "}
              <em>Available</em>, <em>Upcoming</em> or <em>Unavailable</em> from the dropdown to
              update it without opening the edit modal — the change is saved immediately and the
              storefront notice updates the next time visitors load the page.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "admin-media",
    title: "Media & Page Images",
    subtopics: [
      {
        id: "md-upload",
        title: "Uploading images",
        body: (
          <>
            <p>
              Open <strong>Media</strong> and drag files into the dropzone or use the upload
              button. Uploads from your device are automatically converted to AVIF for performance;
              the original is unlinked and the converted file is what's stored and served.
            </p>
            <p>
              All media URLs point to the converted asset, so there is nothing extra to configure.
              If a browser doesn't support AVIF, the image server falls back to the next available
              format (WebP, JPG) at the same path.
            </p>
          </>
        ),
      },
      {
        id: "md-preview",
        title: "Previewing images",
        body: (
          <p>
            Hover any image thumbnail in <strong>Media</strong> or <strong>Menu</strong> to see a
            larger preview pop up. This works the same way on both pages.
          </p>
        ),
      },
      {
        id: "md-usage",
        title: "Usage tracking",
        body: (
          <p>
            The <strong>Used</strong> column counts every place an image is referenced —
            descriptions, products, product variants, categories, promotion slides and page-image
            overrides — so you can see at a glance whether it's safe to delete.
          </p>
        ),
      },
      {
        id: "md-duplicates",
        title: "Scan for duplicates",
        body: (
          <p>
            Use <strong>Scan for duplicates</strong> in Media to find identical images. When you
            merge or remove a duplicate, all references (products, categories, promotion slides,
            page descriptions, page-image overrides) are automatically re-pointed to the kept
            image — nothing breaks visually.
          </p>
        ),
      },
      {
        id: "md-page-images",
        title: "Page Images",
        body: (
          <>
            <p>
              The <strong>Page Images</strong> section lists every image slot used across the site,
              grouped into tabs per page. Each slot shows the image currently in use and a
              <em> Replace</em> button.
            </p>
            <p>
              Even if the same image is used in multiple slots, each appears separately so it can
              be swapped independently. Replacing a slot updates only that slot — other usages of
              the same image are unaffected.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "admin-promotions",
    title: "Promotions & Coupons",
    subtopics: [
      {
        id: "pr-slides",
        title: "Adding image and video slides",
        body: (
          <>
            <p>
              In <strong>Promotions</strong>, open a campaign and use <strong>Add Image</strong> or{" "}
              <strong>Add Video</strong>. Each opens a dropdown with two options: upload from
              device or select from the media library.
            </p>
            <p>
              Reorder slides by dragging or using the up/down arrows. Multiple video slides play
              sequentially — when one ends the next begins.
            </p>
          </>
        ),
      },
      {
        id: "pr-schedule",
        title: "Scheduling a campaign",
        body: (
          <p>
            Set a start date/time and an end date/time on each campaign. Schedules are evaluated in
            Toronto time, so the dates you pick match what your customers in Canada see. A campaign
            without active dates is treated as always-on.
          </p>
        ),
      },
      {
        id: "pr-coupons",
        title: "Coupons",
        body: (
          <>
            <p>Create discount codes in <strong>Coupons</strong>. For each coupon, set:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Code (case-insensitive at checkout)</li>
              <li>Type — percentage or flat amount</li>
              <li>Value</li>
              <li>Minimum order amount</li>
              <li>Usage cap (total uses across all customers)</li>
              <li>Validity window (start/end date)</li>
            </ul>
            <p>Coupons apply to the subtotal before tax.</p>
          </>
        ),
      },
      {
        id: "pr-offers",
        title: "Promotional offers",
        body: (
          <>
            <p>
              Build automatic offers in <strong>Offers</strong>: cart % off, cart $ off, Buy 1
              Get 1 (free or % off) and Buy-X-Get-Y rewards (e.g. <em>buy any lunch combo, add a
              medium smoothie for $3.99</em>). Each offer can be scoped by specific products,
              categories, days of the week, time of day and dining option.
            </p>
            <p>
              On the storefront, offers appear automatically on the <strong>product page</strong>{" "}
              under the price breakup — labelled <em>Reward in this offer</em>,{" "}
              <em>Qualifies for this offer</em>, or <em>Site-wide bonus</em> — with a one-click
              "Add" button when the product is the reward.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "admin-seo",
    title: "SEO Tools",
    subtopics: [
      {
        id: "se-meta",
        title: "Meta tags",
        body: (
          <p>
            Manage page titles, meta descriptions, Open Graph and Twitter card metadata from{" "}
            <strong>SEO Tools</strong>. Titles should be under 60 characters and meta descriptions
            under 160 characters for best display in search results.
          </p>
        ),
      },
      {
        id: "se-schema",
        title: "Structured data (schema)",
        body: (
          <p>
            JSON-LD templates for Organization, WebSite and Restaurant are pre-filled with your
            contact info. Edit the schema JSON directly if you need to add or override fields, then
            save — the schema is injected into the appropriate pages on the storefront.
          </p>
        ),
      },
      {
        id: "se-cache",
        title: "Cache headers (.htaccess)",
        body: (
          <p>
            Cache settings saved here are written into a managed{" "}
            <code># BEGIN/END LOVABLE CACHE</code> block in the server's <code>.htaccess</code>.
            Existing custom rules outside the managed block are preserved.
          </p>
        ),
      },
    ],
  },
  {
    id: "admin-customers",
    title: "Customers & Newsletter",
    subtopics: [
      {
        id: "cs-list",
        title: "Customer list",
        body: (
          <p>
            The <strong>Customers</strong> page lists registered customers with their contact
            info, total orders, total spend and newsletter subscription status. Use it to find
            top customers or to follow up on orders.
          </p>
        ),
      },
      {
        id: "cs-newsletter",
        title: "Newsletter",
        body: (
          <>
            <p>
              Compose and send newsletters using the built-in templates. The live preview shows
              the email exactly as it will be received, including your logo and brand colors.
            </p>
            <p>
              The visual editor supports image insertion from the media library, image resizing
              by drag, and hyperlink tooltips for any linked text.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: "settings",
    title: "Site Settings",
    subtopics: [
      {
        id: "st-logo",
        title: "Logo & branding",
        body: (
          <p>
            Upload your logo from <strong>Settings</strong>. The logo is displayed at consistent
            sizes across the storefront and admin panel and is set to <code>fit="contain"</code>{" "}
            so it never crops.
          </p>
        ),
      },
      {
        id: "st-announce",
        title: "Announcement bar",
        body: (
          <p>
            Edit the rotating message and adjust the <strong>scroll speed</strong> in{" "}
            <strong>Settings</strong>. Higher values scroll faster. Leave the message blank to
            hide the bar.
          </p>
        ),
      },
      {
        id: "st-tabs",
        title: "Tabbed settings layout",
        body: (
          <p>
            The Settings page is organized into <strong>tabs</strong> (General,
            Delivery, AI Providers, etc.) with <strong>Save</strong> buttons at
            both the top and bottom of every tab so you never have to scroll
            back up after a change.
          </p>
        ),
      },
      {
        id: "st-timezone",
        title: "Canadian timezone (America/Toronto)",
        body: (
          <p>
            All order dates and times are displayed in{" "}
            <strong>America/Toronto</strong> across the storefront, admin,
            receipts and owner emails, with clear <em>Date</em> and{" "}
            <em>Time</em> labels — regardless of the viewer's device timezone.
          </p>
        ),
      },
      {
        id: "st-packaging",
        title: "Delivery packaging fee",
        body: (
          <p>
            Set a <strong>delivery packaging fee</strong> in Settings →
            Delivery. It's added automatically to delivery orders and appears
            as a separate line on receipts, modals and the owner notification
            email.
          </p>
        ),
      },
    ],
  },

  {
    id: "troubleshooting",
    title: "Troubleshooting",
    subtopics: [
      {
        id: "tb-image",
        title: "An image isn't updating",
        body: (
          <>
            <p>
              Product images are cache-busted on every update. If a stale image is still visible,
              hard-reload the page (Ctrl/Cmd+Shift+R). The Create Order page polls every 30
              seconds and refreshes whenever the tab regains focus.
            </p>
            <p>
              On the storefront, the image server falls back to the next available format if the
              one requested is missing, so renaming or deleting files manually should be avoided.
            </p>
          </>
        ),
      },
      {
        id: "tb-perm",
        title: "I don't see a page in the admin",
        body: (
          <p>
            Your role may not have permission for that page. Ask a super admin to grant access in{" "}
            <strong>Users → Roles</strong>. New pages appear in the role matrix automatically.
          </p>
        ),
      },
      {
        id: "tb-order",
        title: "An order disappeared",
        body: (
          <p>
            Unpaid online orders are auto-cancelled after 30 minutes. Cancelled orders are not
            deleted — they remain in the <strong>Orders</strong> list with their "cancelled"
            status, and can still be inspected from the order detail page.
          </p>
        ),
      },
      {
        id: "tb-cod",
        title: "COD button errors at checkout",
        body: (
          <p>
            That's by design. COD is disabled for online orders; the option is visible so customers
            know it exists but clicking it shows an error. COD is fully functional in the admin{" "}
            <strong>Create Order</strong> page for counter sales.
          </p>
        ),
      },
    ],
  },
];

// Flat plain-text index for search
function plainText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainText).join(" ");
  if (typeof node === "object" && "props" in (node as any)) {
    return plainText((node as any).props?.children);
  }
  return "";
}

export default function Help() {
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const [visibleTopics, setVisibleTopics] = useState<Set<string>>(() => new Set());
  const [activeId, setActiveId] = useState<string>(TOPICS[0].id);
  const [query, setQuery] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const topicOfId = useMemo(() => {
    const map: Record<string, string> = {};
    TOPICS.forEach((t) => {
      map[t.id] = t.id;
      t.subtopics.forEach((s) => { map[s.id] = t.id; });
    });
    return map;
  }, []);

  const allIds = useMemo(
    () => TOPICS.flatMap((t) => [t.id, ...t.subtopics.map((s) => s.id)]),
    [],
  );

  // Search filter: which topic/subtopic IDs match
  const q = query.trim().toLowerCase();
  const matchedTopicIds = useMemo(() => {
    if (!q) return null;
    const set = new Set<string>();
    TOPICS.forEach((t) => {
      const titleHit = t.title.toLowerCase().includes(q) || plainText(t.intro).toLowerCase().includes(q);
      const subHits = t.subtopics.filter(
        (s) => s.title.toLowerCase().includes(q) || plainText(s.body).toLowerCase().includes(q),
      );
      if (titleHit || subHits.length) set.add(t.id);
    });
    return set;
  }, [q]);

  function subtopicMatches(s: Subtopic) {
    if (!q) return true;
    return s.title.toLowerCase().includes(q) || plainText(s.body).toLowerCase().includes(q);
  }

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    // Scroll-position based: active = the last section whose top has crossed
    // a small threshold below the root's top edge. This avoids the lag where
    // a previous (tall) section stays "intersecting" until fully scrolled past.
    const compute = () => {
      const threshold = root.scrollTop + 96;
      let current = TOPICS[0].id;
      for (const id of allIds) {
        const el = sectionRefs.current[id];
        if (el && el.offsetTop <= threshold) current = id;
      }
      setActiveId(current);

      const visible = new Set<string>();
      const top = root.scrollTop;
      const bottom = top + root.clientHeight;
      for (const id of allIds) {
        const el = sectionRefs.current[id];
        if (!el) continue;
        const ot = el.offsetTop;
        const ob = ot + el.offsetHeight;
        if (ob > top && ot < bottom) {
          const tId = topicOfId[id];
          if (tId) visible.add(tId);
        }
      }
      setVisibleTopics(visible);
    };
    compute();
    root.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      root.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [allIds, topicOfId]);

  function isOpen(topicId: string) {
    if (q) return matchedTopicIds?.has(topicId) ?? false;
    if (topicId in manualOpen) return manualOpen[topicId];
    return visibleTopics.has(topicId);
  }

  function scrollTo(id: string) {
    const el = sectionRefs.current[id];
    const root = contentRef.current;
    if (!el || !root) return;
    root.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
    setActiveId(id);
  }

  function toggleTopic(id: string) {
    const currentlyOpen = isOpen(id);
    setManualOpen((p) => ({ ...p, [id]: !currentlyOpen }));
  }

  const activeTopicId = topicOfId[activeId];

  return (
    <div className="w-full">
      {/* Hero banner */}
      <section className="relative h-44 sm:h-56 flex items-end overflow-hidden border-b border-white/10">
        <img
          src="/uploads/help-hero.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
        <div className="relative w-full px-6 sm:px-10 pb-6 pt-20">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Help &amp; User Manual
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A how-to guide for the Flames Gourmet site and admin panel.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] h-[calc(100vh-14rem)]">
        {/* Left panel */}
        <aside className="border-r border-white/10 bg-[color:var(--card)]/40 overflow-y-auto">
          {/* Sticky search */}
          <div className="sticky top-0 z-10 bg-[color:var(--card)]/95 backdrop-blur border-b border-white/10 px-3 py-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search help…"
                className="w-full bg-black/40 border border-white/10 rounded-md pl-8 pr-8 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[color:var(--flame)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <h2 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--gold)]">
            Help Topics
          </h2>
          <nav className="px-2 pb-6 space-y-1">
            {TOPICS.map((t) => {
              if (matchedTopicIds && !matchedTopicIds.has(t.id)) return null;
              const open = isOpen(t.id);
              const isActiveTopic = activeTopicId === t.id;
              const subs = q ? t.subtopics.filter(subtopicMatches) : t.subtopics;
              return (
                <div key={t.id}>
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleTopic(t.id)}
                      aria-label={open ? "Collapse" : "Expand"}
                      className={cn(
                        "p-1",
                        isActiveTopic ? "text-[color:var(--flame)]" : "text-muted-foreground hover:text-white",
                      )}
                    >
                      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => scrollTo(t.id)}
                      className={cn(
                        "flex-1 text-left px-2 py-1.5 rounded text-sm font-medium",
                        isActiveTopic
                          ? "text-[color:var(--flame)] bg-[color:var(--flame)]/10"
                          : "text-muted-foreground hover:text-white hover:bg-white/5",
                      )}
                    >
                      {t.title}
                    </button>
                  </div>
                  {open && (
                    <ul className="ml-6 mt-0.5 mb-2 space-y-0.5 border-l border-white/10 pl-3">
                      {subs.map((s) => {
                        const sActive = activeId === s.id;
                        return (
                          <li key={s.id}>
                            <button
                              onClick={() => scrollTo(s.id)}
                              className={cn(
                                "w-full text-left px-2 py-1 rounded text-xs",
                                sActive
                                  ? "text-[color:var(--flame)] bg-[color:var(--flame)]/10 border-l-2 -ml-[14px] pl-3 border-[color:var(--flame)]"
                                  : "text-muted-foreground hover:text-white hover:bg-white/5",
                              )}
                            >
                              {s.title}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
            {matchedTopicIds && matchedTopicIds.size === 0 && (
              <div className="px-3 py-6 text-xs text-muted-foreground">No matching topics.</div>
            )}
          </nav>
        </aside>

        {/* Right content */}
        <div ref={contentRef} className="overflow-y-auto px-6 sm:px-10 py-8">
          <div className="space-y-12">
            {TOPICS.map((t) => (
              <section
                key={t.id}
                id={t.id}
                ref={(el) => { sectionRefs.current[t.id] = el; }}
                className="scroll-mt-4"
              >
                <h2 className="text-2xl font-bold text-white border-b border-white/10 pb-2">{t.title}</h2>
                {t.intro && <div className="mt-3 text-sm text-muted-foreground/90 space-y-2">{t.intro}</div>}
                <div className="mt-6 space-y-8">
                  {t.subtopics.map((s) => (
                    <article
                      key={s.id}
                      id={s.id}
                      ref={(el) => { sectionRefs.current[s.id] = el; }}
                      className="scroll-mt-4"
                    >
                      <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                      <div className="mt-2 text-sm text-muted-foreground/90 space-y-2 leading-relaxed">
                        {s.body}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            <footer className="pt-6 pb-12 text-xs text-muted-foreground/70">
              Need more help? Contact the developer{" "}
              <a
                href="https://wa.me/918910435116"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--flame)] hover:underline"
              >
                Prithwish Mukherjee
              </a>
              .
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
