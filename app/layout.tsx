import { ClerkProvider } from '@/lib/providers/ClerkProvider';
import { ThemeProvider } from '@/lib/providers/ThemeProvider';
import { Providers } from '@/src/components/providers/Providers';
import { Toaster } from '@/components/ui/toaster';
import '@/styles/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body>
        <ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
          <ClerkProvider>
            <Providers>
              {children}
              <Toaster />
            </Providers>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
