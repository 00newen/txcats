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
          <p className="text-muted-foreground">
            Define the structure of your financial life. Create and manage custom categories that reflect your personal spending habits. From essential bills to lifestyle choices, build a taxonomy that helps you understand exactly where your money goes.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

