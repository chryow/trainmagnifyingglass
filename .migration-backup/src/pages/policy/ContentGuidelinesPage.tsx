import PolicyPage from '@/components/PolicyPage';

export default function ContentGuidelinesPage() {
  return (
    <PolicyPage title="Content Guidelines" subtitle="What kind of content belongs here and what doesn't.">
      <h2>What to share</h2>
      <p>Share genuine, specific places that others would enjoy visiting — cafés, viewpoints, parks, shops, study spots, and similar hidden gems. Include helpful details like the area, what makes it special, and practical tips.</p>

      <h2>Photos</h2>
      <p>Upload photos you have taken or have permission to share. Do not upload copyrighted images from other sources. Photos should depict the place honestly — no heavy editing that misrepresents the location.</p>

      <h2>What not to post</h2>
      <ul>
        <li>Content that is illegal, harmful, or promotes dangerous activities</li>
        <li>Explicit, violent, or hateful material</li>
        <li>Personal information about others without consent</li>
        <li>Commercial spam or unsolicited advertising</li>
        <li>Duplicate entries for the same place (search first)</li>
        <li>Content about places that don't exist or are purely fictional</li>
      </ul>

      <h2>Comments and discussions</h2>
      <p>Keep comments constructive and relevant to the gem. Disagreement is welcome; personal attacks are not. Repeated off-topic or abusive comments may be removed.</p>

      <h2>Enforcement</h2>
      <p>Content that violates these guidelines may be hidden or removed by moderators. Repeated violations may lead to community suspension or account deactivation. You can appeal moderation decisions through the support page.</p>
    </PolicyPage>
  );
}
