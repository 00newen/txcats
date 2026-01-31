import { PageHeader } from '@/components/core/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function CategorizePage() {
  return (
    <>
      <PageHeader
        title="Categorize"
        subtitle="Manually categorize your transactions"
      />
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            Rapidly organize your pending transactions. This dedicated workspace focuses on uncategorized entries, allowing you to quickly assign them to the right buckets. Keep your data clean and actionable by clearing your inbox of new expenses.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

