import { PageHeader } from '@/components/core/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Manage your transaction categories"
      />
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Coming soon</p>
        </CardContent>
      </Card>
    </>
  );
}

