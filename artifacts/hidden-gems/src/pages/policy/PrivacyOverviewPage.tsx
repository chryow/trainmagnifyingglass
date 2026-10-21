import PolicyPage from '@/components/PolicyPage';

export default function PrivacyOverviewPage() {
  return (
    <PolicyPage title="Privacy Overview" subtitle="How your information is collected, used, and protected.">
      <h2>What we collect</h2>
      <p>When you create an account, we store your email address, username, display name, and any optional profile details you choose to share (such as your general area and bio).</p>

      <h2>What others can see</h2>
      <p>Your username, display name, profile photo, and the gems, collections, and comments you publish are visible to other members according to your privacy settings. You can control whether your general area, following list, and followers list are shown on your profile.</p>

      <h2>How we use your data</h2>
      <p>We use your information to provide the service — showing your contributions, sending notifications you've opted into, and keeping the community safe through moderation tools.</p>

      <h2>Your choices</h2>
      <p>You can adjust your privacy and notification preferences at any time from Settings. You can block other users, and you can permanently delete your account, which anonymizes your public contributions and removes your private data.</p>

      <h2>Data retention</h2>
      <p>We retain your data for as long as your account is active. When you delete your account, private data is removed and public contributions are anonymized. Moderation and security records are retained without your identity for safety purposes.</p>
    </PolicyPage>
  );
}
