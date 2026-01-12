import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "MLD WillCall",
  description: "Pickup scheduling and staff dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}