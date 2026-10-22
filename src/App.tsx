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
import EditCommunityPage from '@/pages/EditCommunityPage';
import ProfilePage from '@/pages/ProfilePage';
import EditProfilePage from '@/pages/EditProfilePage';
import PrivacySettingsPage from '@/pages/PrivacySettingsPage';
import PlaceholderPage from '@/pages/PlaceholderPage';
import ExplorePage from '@/pages/ExplorePage';
import CreateGemPage from '@/pages/CreateGemPage';
import GemDetailsPage from '@/pages/GemDetailsPage';
import SearchPage from '@/pages/SearchPage';
import CollectionsPage from '@/pages/CollectionsPage';
import CollectionDetailsPage from '@/pages/CollectionDetailsPage';
import CreateCollectionPage from '@/pages/CreateCollectionPage';
import FollowingPage from '@/pages/FollowingPage';
import NotificationsPage from '@/pages/NotificationsPage';
import BlockedUsersPage from '@/pages/BlockedUsersPage';
import ModeratorDashboardPage from '@/pages/ModeratorDashboardPage';
import AdminPanelPage from '@/pages/AdminPanelPage';
import ChangePasswordPage from '@/pages/ChangePasswordPage';
import DeleteAccountPage from '@/pages/DeleteAccountPage';
import PrivacyOverviewPage from '@/pages/policy/PrivacyOverviewPage';
import TermsOfUsePage from '@/pages/policy/TermsOfUsePage';
import CommunityGuidelinesPage from '@/pages/policy/CommunityGuidelinesPage';
import AccuracyDisclaimerPage from '@/pages/policy/AccuracyDisclaimerPage';
import ContentGuidelinesPage from '@/pages/policy/ContentGuidelinesPage';
import DeletionInfoPage from '@/pages/policy/DeletionInfoPage';
import SupportPage from '@/pages/policy/SupportPage';



// Routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/login', '/register', '/reset-password',
  '/privacy', '/terms', '/guidelines', '/accuracy', '/content-guidelines', '/deletion-info', '/support'];

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

  // Policy pages — accessible without auth, wrapped in AppShell when logged in
  const policyPages: Record<string, React.ReactNode> = {
    '/privacy': <PrivacyOverviewPage />,
    '/terms': <TermsOfUsePage />,
    '/guidelines': <CommunityGuidelinesPage />,
    '/accuracy': <AccuracyDisclaimerPage />,
    '/content-guidelines': <ContentGuidelinesPage />,
    '/deletion-info': <DeletionInfoPage />,
    '/support': <SupportPage />,
  };
  if (policyPages[path]) {
    return session ? <AppShell>{policyPages[path]}</AppShell> : policyPages[path];
  }

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

    if (path === '/explore') return <ExplorePage />;
    if (matchPath('/search', path)) return <SearchPage />;

    if (path === '/communities') return <CommunitiesPage />;
    if (path === '/communities/new') return <CreateCommunityPage />;
    if (matchPath('/communities/:id/edit', path)) return <EditCommunityPage />;
    if (matchPath('/communities/:id', path)) return <CommunityDetailsPage />;

    if (path === '/gems/new') return <CreateGemPage />;
    if (matchPath('/gems/:id', path)) return <GemDetailsPage />;

    if (path === '/collections') return <CollectionsPage />;
    if (path === '/collections/new') return <CreateCollectionPage />;
    if (matchPath('/collections/:id', path)) return <CollectionDetailsPage />;

    if (path === '/following') return <FollowingPage />;
    if (path === '/notifications') return <NotificationsPage />;
    if (path === '/settings/blocked') return <BlockedUsersPage />;
    if (matchPath('/moderation/:id', path)) return <ModeratorDashboardPage />;
    if (path === '/admin') return <AdminPanelPage />;

    if (path === '/profile/edit') return <EditProfilePage />;
    if (path === '/profile' || matchPath('/profile/:id', path)) return <ProfilePage />;
    if (path === '/settings/password') return <ChangePasswordPage />;
    if (path === '/settings/delete-account') return <DeleteAccountPage />;
    if (path === '/settings') return <PrivacySettingsPage />;

    return <PlaceholderPage title="Page not found" description="This page doesn't exist yet or may have moved." backTo="/discover" />;
  };

  return <AppShell>{renderRoute()}</AppShell>;
}

export default function App() {
  return <Router />;
}
