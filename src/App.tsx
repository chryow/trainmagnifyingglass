import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRoute, useNavigate, matchPath } from '@/lib/router';
import { AppShell } from '@/components/AppShell';
import { FullPageLoader } from '@/components/States';

import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import OnboardingPage from '@/pages/OnboardingPage';
import DiscoverPage from '@/pages/DiscoverPage';
import CommunitiesPage from '@/pages/CommunitiesPage';
import CommunityDetailsPage from '@/pages/CommunityDetailsPage';
import CreateCommunityPage from '@/pages/CreateCommunityPage';
import ProfilePage from '@/pages/ProfilePage';
import EditProfilePage from '@/pages/EditProfilePage';
import PrivacySettingsPage from '@/pages/PrivacySettingsPage';
import PlaceholderPage from '@/pages/PlaceholderPage';
import CreateGemPage from '@/pages/CreateGemPage';
import GemDetailsPage from '@/pages/GemDetailsPage';
import SearchPage from '@/pages/SearchPage';

import { Bell, Layers, Map, Heart } from 'lucide-react';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/login', '/register', '/reset-password'];

function Router() {
  const route = useRoute();
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();

  const path = route.path;

  // Redirect to onboarding if not completed (but allow onboarding/settings/profile-edit)
  const onboardingRoutes = ['/onboarding', '/login', '/register', '/reset-password', '/'];
  const needsOnboarding = !!session && !!profile && !profile.onboarding_completed && !onboardingRoutes.includes(path);

  useEffect(() => {
    if (loading) return;
    if (!session && !PUBLIC_ROUTES.includes(path)) {
      navigate('/login');
    } else if (session && (path === '/' || path === '/login' || path === '/register')) {
      if (profile && !profile.onboarding_completed) navigate('/onboarding');
      else navigate('/discover');
    } else if (needsOnboarding) {
      navigate('/onboarding');
    }
  }, [loading, session, profile, path, needsOnboarding, navigate]);

  // Public routes (no auth)
  if (path === '/') return <LandingPage />;
  if (path === '/login') return <LoginPage />;
  if (path === '/register') return <RegisterPage />;
  if (path === '/reset-password') return <ResetPasswordPage />;

  if (loading) return <FullPageLoader />;

  // Not authenticated → redirect handled by effect; show loader meanwhile
  if (!session) return <FullPageLoader label="Redirecting to sign in…" />;

  // Onboarding gate
  if (profile && !profile.onboarding_completed) {
    if (path === '/onboarding') return <OnboardingPage />;
    return <FullPageLoader label="Redirecting to onboarding…" />;
  }

  // Authenticated + onboarding complete → app routes (wrapped in AppShell)
  const renderRoute = () => {
    if (path === '/onboarding') return <OnboardingPage />;

    // Main app routes
    if (path === '/discover') return <DiscoverPage />;

    if (path === '/explore') return <PlaceholderPage title="Explore" description="The full explore screen with filters and sorting will arrive in a future phase." icon={Map} />;
    if (matchPath('/search', path)) return <SearchPage />;

    if (path === '/communities') return <CommunitiesPage />;
    if (matchPath('/communities/:id', path)) return <CommunityDetailsPage />;
    if (path === '/communities/new') return <CreateCommunityPage />;

    if (path === '/gems/new') return <CreateGemPage />;
    if (matchPath('/gems/:id', path)) return <GemDetailsPage />;

    if (path === '/collections') return <PlaceholderPage title="Collections" description="Collections will be introduced in Phase 3, letting you organize gems into curated lists." icon={Layers} />;
    if (matchPath('/collections/:id', path)) return <PlaceholderPage title="Collection" description="Collection details will be available in Phase 3." icon={Layers} />;

    if (path === '/following') return <PlaceholderPage title="Following" description="A feed of gems and collections from people you follow will arrive in Phase 3." icon={Heart} />;
    if (path === '/notifications') return <PlaceholderPage title="Notifications" description="Realtime notifications will be added in Phase 3." icon={Bell} />;

    if (path === '/profile' || matchPath('/profile/:id', path)) return <ProfilePage />;
    if (path === '/profile/edit') return <EditProfilePage />;
    if (path === '/settings') return <PrivacySettingsPage />;

    return <PlaceholderPage title="Page not found" description="This page doesn't exist yet or may have moved." backTo="/discover" />;
  };

  return <AppShell>{renderRoute()}</AppShell>;
}

export default function App() {
  return <Router />;
}
