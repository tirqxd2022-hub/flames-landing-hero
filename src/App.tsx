import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/lib/cart";
import { AuthProvider } from "@/lib/auth";
import SiteLayout from "@/components/layout/SiteLayout";
import ScrollToTop from "@/components/ScrollToTop";
import Home from "@/pages/Home";

const Menu = lazy(() => import("@/pages/Menu"));
const Shop = lazy(() => import("@/pages/Shop"));
const Category = lazy(() => import("@/pages/Category"));
const Product = lazy(() => import("@/pages/Product"));
const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));
const Cart = lazy(() => import("@/pages/Cart"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const OrderSuccess = lazy(() => import("@/pages/OrderSuccess"));
const OrderDetails = lazy(() => import("@/pages/OrderDetails"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ViewOrders = lazy(() => import("@/pages/ViewOrders"));
const CurrentOrders = lazy(() => import("@/pages/CurrentOrders"));
const CreateOrder = lazy(() => import("@/pages/CreateOrder"));
const Profile = lazy(() => import("@/pages/Profile"));
const Legal = lazy(() => import("@/pages/Legal"));
const SearchPage = lazy(() => import("@/pages/Search"));
const Help = lazy(() => import("@/pages/Help"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const AdminLogin = lazy(() => import("@/pages/admin/Login"));
const AdminLayout = lazy(() => import("@/pages/admin/Layout"));
const AdminOrders = lazy(() => import("@/pages/admin/Orders"));
const AdminMenu = lazy(() => import("@/pages/admin/Menu"));
const AdminMedia = lazy(() => import("@/pages/admin/Media"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const AdminInventory = lazy(() => import("@/pages/admin/Inventory"));
const AdminReports = lazy(() => import("@/pages/admin/Reports"));
const AdminAttendance = lazy(() => import("@/pages/admin/Attendance"));
const AdminAccount = lazy(() => import("@/pages/admin/Account"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminNewsletter = lazy(() => import("@/pages/admin/Newsletter"));
const AdminCustomers = lazy(() => import("@/pages/admin/Customers"));
const AdminReviews = lazy(() => import("@/pages/admin/Reviews"));
const AdminSubmissions = lazy(() => import("@/pages/admin/Submissions"));
const AdminSeo = lazy(() => import("@/pages/admin/Seo"));
const AdminCoupons = lazy(() => import("@/pages/admin/Coupons"));
const AdminPromotions = lazy(() => import("@/pages/admin/Promotions"));
const AdminPageImages = lazy(() => import("@/pages/admin/PageImages"));
const AdminOffers = lazy(() => import("@/pages/admin/Offers"));
const PromotionsView = lazy(() => import("@/pages/Promotions"));
const OffersView = lazy(() => import("@/pages/Offers"));
const TrackOrder = lazy(() => import("@/pages/TrackOrder"));

function RouteFallback() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="h-8 w-8 rounded-full border-2 border-[color:var(--flame)] border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<SiteLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/category/:slug" element={<Category />} />
              <Route path="/product/:slug" element={<Product />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order/:orderNumber" element={<OrderSuccess />} />
              <Route path="/o/:orderNumber" element={<OrderDetails />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/orders" element={<ViewOrders />} />
              <Route path="/current-orders" element={<CurrentOrders />} />
              <Route path="/create-order" element={<CreateOrder />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/legal/:slug" element={<Legal />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/help" element={<Help />} />
              <Route path="/offers" element={<OffersView />} />
              <Route path="/track" element={<TrackOrder />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="/promotions" element={<PromotionsView />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="menu" element={<AdminMenu />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="attendance" element={<AdminAttendance />} />
              <Route path="media" element={<AdminMedia />} />
              <Route path="newsletter" element={<AdminNewsletter />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="submissions" element={<AdminSubmissions />} />
              <Route path="seo" element={<AdminSeo />} />
              <Route path="coupons" element={<AdminCoupons />} />
              <Route path="promotions" element={<AdminPromotions />} />
              <Route path="offers" element={<AdminOffers />} />
              <Route path="page-images" element={<AdminPageImages />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="account" element={<AdminAccount />} />
            </Route>
          </Routes>
        </Suspense>
        <Toaster richColors position="top-center" />
      </CartProvider>
    </AuthProvider>
  );
}
