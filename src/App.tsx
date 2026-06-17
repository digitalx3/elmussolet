import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ListAccessProvider } from "@/contexts/ListAccessContext";
import { ProtectedRoute, AdminRoute } from "@/components/auth/ProtectedRoute";
import PublicLayout from "@/components/layout/PublicLayout";
import HomePage from "@/pages/HomePage";
import CatalogPage from "@/pages/CatalogPage";
import BirthListAccessPage from "@/pages/BirthListAccessPage";
import BirthListViewPage from "@/pages/BirthListViewPage";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import AccountDashboard from "@/pages/AccountDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import ProductDetailPage from "@/pages/ProductDetailPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import CreateBirthListPage from "@/pages/CreateBirthListPage";
import NotFound from "@/pages/NotFound";
import CmsPagePage from "@/pages/CmsPagePage";
import ContactPage from "@/pages/ContactPage";
import AppearanceInjector from "@/components/AppearanceInjector";
import MediaConfigLoader from "@/components/MediaConfigLoader";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <ListAccessProvider>
            <TooltipProvider>
              <Sonner />
              <AppearanceInjector />
              <MediaConfigLoader />
              <BrowserRouter>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
                  <Route path="/cataleg" element={<PublicLayout><CatalogPage /></PublicLayout>} />
                  <Route path="/cataleg/:categorySlug" element={<PublicLayout><CatalogPage /></PublicLayout>} />
                  <Route path="/llista-naixement" element={<PublicLayout><BirthListAccessPage /></PublicLayout>} />
                  <Route path="/llista-naixement/:listCode" element={<PublicLayout><BirthListViewPage /></PublicLayout>} />
                  <Route path="/producte/:slug" element={<PublicLayout><ProductDetailPage /></PublicLayout>} />
                  <Route path="/cistella" element={<PublicLayout><CartPage /></PublicLayout>} />
                  <Route path="/checkout" element={<PublicLayout><CheckoutPage /></PublicLayout>} />
                  <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />
                  <Route path="/registre" element={<PublicLayout><RegisterPage /></PublicLayout>} />
                  <Route path="/recuperar-contrasenya" element={<PublicLayout><ForgotPasswordPage /></PublicLayout>} />
                  <Route path="/reset-password" element={<PublicLayout><ResetPasswordPage /></PublicLayout>} />
                  <Route path="/pagina/:slug" element={<PublicLayout><CmsPagePage /></PublicLayout>} />
                  <Route path="/contacte" element={<PublicLayout><ContactPage /></PublicLayout>} />
                  <Route path="/contacto" element={<PublicLayout><ContactPage /></PublicLayout>} />

                  {/* Protected routes */}
                  <Route path="/la-meva-llista" element={<PublicLayout><ProtectedRoute><CreateBirthListPage /></ProtectedRoute></PublicLayout>} />
                  <Route path="/el-meu-compte" element={<PublicLayout><ProtectedRoute><AccountDashboard /></ProtectedRoute></PublicLayout>} />
                  <Route path="/el-meu-compte/*" element={<PublicLayout><ProtectedRoute><AccountDashboard /></ProtectedRoute></PublicLayout>} />

                  {/* Admin routes — no PublicLayout to avoid sticky header overlapping the sidebar */}
                  <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                  <Route path="/admin/*" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

                  <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ListAccessProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
