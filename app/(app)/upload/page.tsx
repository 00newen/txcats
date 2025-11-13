import { PageHeader } from '@/components/core/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function UploadPage() {
  return (
    <>
      <PageHeader
        title="Upload"
        subtitle="Import transactions from CSV files"
      />
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Coming soon</p>
        </CardContent>
      </Card>
    </>
  );
}

