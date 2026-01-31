import { PageHeader } from '@/components/core/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function LockPage() {
  return (
    <>
      <PageHeader
        title="Lock"
        subtitle="Security and encryption settings"
      />
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            Advanced security for your peace of mind. Manage your encryption keys and privacy settings to ensure your sensitive financial data remains strictly confidential. Control access and protect your information with industry-standard security protocols.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

