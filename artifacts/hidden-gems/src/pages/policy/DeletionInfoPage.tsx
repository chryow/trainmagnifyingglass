import PolicyPage from '@/components/PolicyPage';

export default function DeletionInfoPage() {
  return (
    <PolicyPage title="Account Deletion" subtitle="What happens when you delete your account.">
      <h2>How to delete your account</h2>
      <p>You can delete your account at any time from Settings → Delete my account. You will be asked to enter your password, type a confirmation phrase, and acknowledge what will happen.</p>

      <h2>What gets removed immediately</h2>
      <ul>
        <li>Your private collections and their contents</li>
        <li>Your saved gems list</li>
        <li>All follow and block relationships</li>
        <li>Community memberships (not communities you own)</li>
        <li>Your notifications</li>
        <li>Your profile details (bio, area, avatar)</li>
      </ul>

      <h2>What stays (anonymized)</h2>
      <ul>
        <li>Published gems — shown as authored by "Deleted User"</li>
        <li>Comments and replies — shown as "Deleted User"</li>
        <li>Community corrections and confirmations — anonymized</li>
        <li>Moderation and security records — retained without your identity</li>
      </ul>

      <h2>Why some content is preserved</h2>
      <p>Public contributions are part of the community's shared knowledge. Removing them entirely would create gaps in conversations and collection context. Anonymizing ensures your identity is no longer associated with the content while preserving the community's value.</p>

      <h2>Communities you own</h2>
      <p>If you own a community, it is not automatically deleted with your account. Contact support if you need to transfer or delete a community you own.</p>

      <h2>Recovery</h2>
      <p>Account deletion is permanent and cannot be undone. Once deleted, you cannot log in with the same credentials, and your private data cannot be recovered.</p>
    </PolicyPage>
  );
}
