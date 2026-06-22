import GoogleDriveConnectionCard from '@/components/GoogleDriveConnectionCard';

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Account integrations and preferences. Connect Google Drive here once — it applies across projects, tasks, and
          screenshots.
        </p>
      </div>

      <GoogleDriveConnectionCard returnPath="/admin/settings" />
    </div>
  );
}
