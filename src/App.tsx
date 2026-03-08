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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <ListAccessProvider>
            <TooltipProvider>
              <Sonner />
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

                  {/* Protected routes */}
                  <Route path="/el-meu-compte" element={<PublicLayout><ProtectedRoute><AccountDashboard /></ProtectedRoute></PublicLayout>} />
                  <Route path="/el-meu-compte/*" element={<PublicLayout><ProtectedRoute><AccountDashboard /></ProtectedRoute></PublicLayout>} />

                  {/* Admin routes */}
                  <Route path="/admin" element={<PublicLayout><AdminRoute><AdminDashboard /></AdminRoute></PublicLayout>} />
                  <Route path="/admin/*" element={<PublicLayout><AdminRoute><AdminDashboard /></AdminRoute></PublicLayout>} />

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
