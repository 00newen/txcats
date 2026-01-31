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
          <p className="text-muted-foreground">
            Seamlessly import your financial history. Drag and drop your bank CSV files to instantly populate your transaction records. Our intelligent import system detects duplicates and prepares your data for analysis, making it easier than ever to keep your records current.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

