import './globals.css';
export const metadata = {title:'Leakline — Phase 1 audit',description:'Public dataset integrity audit using FalkorDB connected components.'};
export default function RootLayout({children}: Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
