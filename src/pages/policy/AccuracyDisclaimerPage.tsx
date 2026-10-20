import PolicyPage from '@/components/PolicyPage';

export default function AccuracyDisclaimerPage() {
  return (
    <PolicyPage title="Accuracy Disclaimer" subtitle="How community-contributed information works and its limitations.">
      <h2>Community-sourced content</h2>
      <p>The places, descriptions, and details on this platform are contributed by community members. While many are accurate and helpful, we cannot guarantee that all information is correct, current, or complete.</p>

      <h2>Verification system</h2>
      <p>We use a community verification system. Members can confirm whether a gem's information is still accurate, report that it has changed, or suggest corrections. Verification statuses (such as "Community Confirmed" or "May Be Outdated") reflect recent community feedback, not a guarantee.</p>

      <h2>Before you go</h2>
      <p>Always verify important details — such as opening hours, accessibility, or pricing — directly with the place before making a trip. Conditions change, and even recently confirmed information may be out of date.</p>

      <h2>Help improve accuracy</h2>
      <p>If you visit a place and notice the information has changed, use the "Suggest a correction" feature or submit a confirmation. Your input helps keep the community's knowledge reliable for everyone.</p>

      <h2>Limitation of responsibility</h2>
      <p>We are not responsible for losses or inconvenience resulting from inaccurate or outdated information on the platform. Use your judgment and corroborate details when it matters.</p>
    </PolicyPage>
  );
}
