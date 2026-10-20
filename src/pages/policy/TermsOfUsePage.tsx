import PolicyPage from '@/components/PolicyPage';

export default function TermsOfUsePage() {
  return (
    <PolicyPage title="Terms of Use" subtitle="The rules for using this application.">
      <h2>Acceptance of terms</h2>
      <p>By creating an account or using this application, you agree to these terms. If you do not agree, please do not use the service.</p>

      <h2>Your account</h2>
      <p>You are responsible for maintaining the security of your account and password. You agree not to share your account or impersonate another person.</p>

      <h2>Your content</h2>
      <p>You retain ownership of content you publish. By posting, you grant the application a license to display it within the service. You agree not to post content that is unlawful, infringes others' rights, or violates community guidelines.</p>

      <h2>Acceptable use</h2>
      <p>You agree not to harass other users, spam, post misinformation intentionally, circumvent safety features, or attempt to access data you are not authorized to view. Violations may result in content removal, suspension, or account deactivation.</p>

      <h2>Service availability</h2>
      <p>We strive to keep the service available but do not guarantee uninterrupted access. Features may change or be removed over time.</p>

      <h2>Limitation of liability</h2>
      <p>The application is provided "as is." We are not liable for damages arising from use of the service. Community-contributed information may not be accurate — always verify before relying on it.</p>
    </PolicyPage>
  );
}
